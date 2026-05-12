use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};

use crate::{
    db::{self, Skill},
    AppState,
};

use super::github_import::{
    build_preview_skills, central_skills_root, classify_skill_manifest_path,
    current_central_skill_ids, is_safe_repo_relative_path,
    parse_frontmatter, sanitize_skill_id,
    DuplicateResolution, GitHubImportProgressPayload, GitHubImportProgressPhase,
    GitHubRepoPreview, GitHubRepoRef, GitHubSkillImportSelection,
    ImportedGitHubSkillSummary, RemoteSkillCandidate, RemoteSkillFileEntry,
    SnapshotSourceFile,
};

// ─── Git Host Detection ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GitHost {
    GitHub,
    Generic,
}

impl std::fmt::Display for GitHost {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GitHost::GitHub => write!(f, "GitHub"),
            GitHost::Generic => write!(f, "Git"),
        }
    }
}

struct TempDirGuard(PathBuf);

impl TempDirGuard {
    fn new(path: PathBuf) -> Self {
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDirGuard {
    fn drop(&mut self) {
        if !self.0.as_os_str().is_empty() {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
}

/// Detect whether a URL points to GitHub or a generic Git server.
fn detect_git_host(url: &str) -> GitHost {
    let trimmed = url.trim();
    if let Ok(parsed) = reqwest::Url::parse(trimmed) {
        if parsed.host_str() == Some("github.com") {
            return GitHost::GitHub;
        }
    }
    // Also match git@github.com:owner/repo SSH URLs
    if trimmed.starts_with("git@github.com:") {
        return GitHost::GitHub;
    }
    GitHost::Generic
}

/// Parse branch from URL fragment (#branch) or return None for default.
fn extract_branch_from_url(url: &str) -> (String, Option<String>) {
    let trimmed = url.trim();
    // Handle #branch suffix
    if let Some(hash_pos) = trimmed.rfind('#') {
        let branch = trimmed[hash_pos + 1..].trim().to_string();
        if !branch.is_empty() {
            return (trimmed[..hash_pos].trim().to_string(), Some(branch));
        }
    }
    (trimmed.to_string(), None)
}

// ─── Git Clone Infrastructure ────────────────────────────────────────────────

/// Check if `git` is available on the system PATH.
fn check_git_available() -> Result<(), String> {
    let output = std::process::Command::new("git")
        .arg("--version")
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Git is not installed or not on PATH. Please install Git to import from non-GitHub repositories.".to_string()
            } else {
                format!("Failed to check Git availability: {}", e)
            }
        })?;

    if !output.status.success() {
        return Err("Git is not available. Please install Git to import from non-GitHub repositories.".to_string());
    }
    Ok(())
}

/// Validate that a git URL uses an allowed scheme.
/// Rejects file://, local paths, and other dangerous schemes.
fn validate_git_url(url: &str) -> Result<(), String> {
    let trimmed = url.trim();

    // Reject obviously local / dangerous inputs
    if trimmed.is_empty() {
        return Err("Repository URL cannot be empty.".to_string());
    }
    if trimmed.starts_with('/') || trimmed.starts_with("..") || trimmed.starts_with("./") {
        return Err("Local paths are not supported. Please use an HTTPS or SSH URL.".to_string());
    }
    if trimmed.starts_with("file://") {
        return Err("file:// URLs are not supported for security reasons. Please use HTTPS or SSH.".to_string());
    }

    // Validate HTTPS URLs
    if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        if let Ok(parsed) = reqwest::Url::parse(trimmed) {
            if parsed.host_str().is_none() || parsed.host_str() == Some("") {
                return Err("Invalid repository URL: missing hostname.".to_string());
            }
            return Ok(());
        }
        return Err("Invalid repository URL.".to_string());
    }

    // Validate SSH URLs: git@host:path or ssh://user@host/path
    if trimmed.starts_with("git@") || trimmed.starts_with("ssh://") {
        return Ok(());
    }

    Err("Unsupported URL format. Please use HTTPS (https://host/owner/repo) or SSH (git@host:owner/repo).".to_string())
}

/// Validate that a branch name doesn't look like a git flag.
fn validate_branch_name(branch: &str) -> Result<(), String> {
    if branch.starts_with('-') {
        return Err(format!("Invalid branch name '{}': branch names cannot start with '-'.", branch));
    }
    if branch.is_empty() {
        return Err("Branch name cannot be empty.".to_string());
    }
    if branch.contains('\0') {
        return Err("Branch name contains invalid characters.".to_string());
    }
    Ok(())
}

/// Clone a git repository to a temporary directory with `--depth 1`.
/// Returns a `TempDirGuard` that auto-cleans the temp directory on drop.
fn clone_repo_to_temp(url: &str, branch: Option<&str>) -> Result<TempDirGuard, String> {
    validate_git_url(url)?;
    if let Some(branch) = branch {
        validate_branch_name(branch)?;
    }

    check_git_available()?;

    let temp_dir = std::env::temp_dir().join(format!(
        "skill-link-git-import-{}",
        uuid::Uuid::new_v4()
    ));

    let mut cmd = std::process::Command::new("git");
    cmd.arg("clone")
        .arg("--depth")
        .arg("1");

    if let Some(branch) = branch {
        cmd.arg("--branch").arg(branch);
    }

    // Use -- to prevent git from interpreting URL as a flag
    // (e.g. --upload-pack=evil or --config=core.sshCommand=evil)
    cmd.arg("--")
        .arg(url)
        .arg(&temp_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let output = cmd.output().map_err(|e| {
        format!("Failed to execute git clone: {}", e)
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = std::fs::remove_dir_all(&temp_dir);

        let stderr_lower = stderr.to_lowercase();
        if stderr_lower.contains("not found") || stderr_lower.contains("could not read") {
            return Err(format!("Repository not found: {}. Please verify the URL is correct and the repository exists.", strip_credentials_from_url(url)));
        }
        if stderr_lower.contains("authentication failed") || stderr_lower.contains("permission denied") || stderr_lower.contains("could not read from remote") {
            return Err(format!(
                "Authentication failed for {}. Please ensure your Git credentials are configured (SSH key, credential helper, or .netrc).",
                strip_credentials_from_url(url)
            ));
        }
        if stderr_lower.contains("repository not found") {
            return Err(format!("Repository not found: {}", strip_credentials_from_url(url)));
        }
        if let Some(branch) = branch {
            if stderr_lower.contains("remote branch") && stderr_lower.contains("not found") {
                return Err(format!("Branch '{}' not found in repository.", branch));
            }
        }

        return Err("git clone failed. Please verify the URL and your access credentials.".to_string());
    }

    if !temp_dir.is_dir() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("git clone completed but the target directory was not created.".to_string());
    }

    Ok(TempDirGuard::new(temp_dir))
}

/// Build a `GitHubRepoSnapshot`-equivalent from a local directory.
/// Returns a map of relative_path -> file_bytes.
/// Skips files larger than MAX_FILE_SIZE_BYTES.
const MAX_FILE_SIZE_BYTES: u64 = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_SNAPSHOT_BYTES: u64 = 500 * 1024 * 1024; // 500 MB total

fn snapshot_from_local_dir(dir: &Path) -> Result<HashMap<String, Vec<u8>>, String> {
    let mut files = HashMap::new();
    let mut total_bytes: u64 = 0;
    collect_files_recursive(dir, dir, &mut files, &mut total_bytes)?;
    Ok(files)
}

fn collect_files_recursive(
    base: &Path,
    current: &Path,
    files: &mut HashMap<String, Vec<u8>>,
    total_bytes: &mut u64,
) -> Result<(), String> {
    let entries = std::fs::read_dir(current)
        .map_err(|e| format!("Failed to read directory '{}': {}", current.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // Skip .git directory
        if path.file_name().map(|n| n == ".git").unwrap_or(false) {
            continue;
        }

        if path.is_dir() {
            collect_files_recursive(base, &path, files, total_bytes)?;
        } else if path.is_file() {
            let metadata = std::fs::metadata(&path).map_err(|e| {
                format!("Failed to read file metadata '{}': {}", path.display(), e)
            })?;

            if metadata.len() > MAX_FILE_SIZE_BYTES {
                continue; // Skip oversized files
            }
            if *total_bytes + metadata.len() > MAX_TOTAL_SNAPSHOT_BYTES {
                return Err(format!(
                    "Repository is too large to import (exceeded {} MB limit). Consider using a smaller repository or a GitHub URL for partial downloads.",
                    MAX_TOTAL_SNAPSHOT_BYTES / (1024 * 1024)
                ));
            }

            let relative = path
                .strip_prefix(base)
                .map_err(|e| format!("Path prefix error: {}", e))?;
            let relative_str = relative.to_string_lossy().replace('\\', "/");

            if !is_safe_repo_relative_path(&relative_str) {
                continue;
            }

            let content = std::fs::read(&path).map_err(|e| {
                format!("Failed to read file '{}': {}", path.display(), e)
            })?;
            *total_bytes += content.len() as u64;
            files.insert(relative_str, content);
        }
    }
    Ok(())
}

/// Build skill candidates from a local directory snapshot.
/// Similar to `build_repo_skill_candidates_from_snapshot` but for generic git repos.
fn build_candidates_from_local_snapshot(
    repo_url: &str,
    files: &HashMap<String, Vec<u8>>,
) -> Result<Vec<RemoteSkillCandidate>, String> {
    let mut manifests = files
        .keys()
        .filter_map(|path| classify_skill_manifest_path(path))
        .collect::<Vec<_>>();
    manifests.sort_by(|left, right| left.source_path.cmp(&right.source_path));

    let mut candidates = Vec::with_capacity(manifests.len());
    for manifest in manifests {
        let raw = files
            .get(&manifest.skill_md_path)
            .ok_or_else(|| format!("Missing snapshot file '{}'.", manifest.skill_md_path))?;
        let content = String::from_utf8(raw.clone())
            .map_err(|_| format!("Skill '{}' is not valid UTF-8.", manifest.source_path))?;
        let frontmatter = parse_frontmatter(&content).ok_or_else(|| {
            if manifest.source_path == "." {
                "Repository root SKILL.md is missing valid frontmatter.".to_string()
            } else {
                format!("Skill '{}' is missing valid frontmatter.", manifest.source_path)
            }
        })?;

        // For generic repos, derive skill_id from directory name or repo URL
        let skill_id = if manifest.source_path == "." {
            let repo_name = extract_repo_name_from_url(repo_url);
            let id = sanitize_skill_id(&repo_name)?;
            id.strip_suffix("-skill")
                .unwrap_or(&id)
                .to_string()
        } else {
            sanitize_skill_id(&manifest.skill_directory_name)?
        };

        candidates.push(RemoteSkillCandidate {
            source_path: manifest.source_path.clone(),
            skill_id,
            skill_name: frontmatter.name,
            description: frontmatter.description,
            root_directory: manifest.root_directory,
            skill_directory_name: if manifest.source_path == "." {
                extract_repo_name_from_url(repo_url)
            } else {
                manifest.skill_directory_name
            },
            // For generic git repos, download_url is the repo URL itself;
            // the frontend will use it together with the source_path for reference.
            download_url: repo_url.to_string(),
        });
    }

    Ok(candidates)
}

/// Extract a human-readable repo name from a git URL.
fn extract_repo_name_from_url(url: &str) -> String {
    let trimmed = url.trim();

    // Handle SSH URLs: git@host:owner/repo.git
    if let Some(colon_pos) = trimmed.find(':') {
        if trimmed.starts_with("git@") || trimmed.starts_with("ssh://") {
            let path_part = &trimmed[colon_pos + 1..];
            let name = path_part
                .trim_end_matches(".git")
                .trim_end_matches('/');
            if let Some(slash_pos) = name.rfind('/') {
                return name[slash_pos + 1..].to_string();
            }
            return name.to_string();
        }
    }

    // Handle HTTPS URLs
    if let Ok(parsed) = reqwest::Url::parse(trimmed) {
        let path = parsed.path().trim_end_matches(".git").trim_end_matches('/');
        if let Some(slash_pos) = path.rfind('/') {
            return path[slash_pos + 1..].to_string();
        }
        return path.trim_start_matches('/').to_string();
    }

    // Fallback: just use the last segment
    let name = trimmed.trim_end_matches(".git").trim_end_matches('/');
    if let Some(slash_pos) = name.rfind('/') {
        name[slash_pos + 1..].to_string()
    } else {
        name.to_string()
    }
}

/// Build a `GitHubRepoRef`-compatible struct from a generic git URL.
fn build_repo_ref_from_url(url: &str, branch: Option<&str>) -> Result<GitHubRepoRef, String> {
    let (clean_url, url_branch) = extract_branch_from_url(url);
    let effective_branch = branch
        .map(|b| b.to_string())
        .or(url_branch)
        .unwrap_or_else(|| "main".to_string());

    let owner = extract_owner_from_url(&clean_url);
    let safe_url = strip_credentials_from_url(&clean_url);

    Ok(GitHubRepoRef {
        owner,
        repo: extract_repo_name_from_url(&clean_url),
        branch: effective_branch,
        normalized_url: safe_url,
    })
}

fn extract_owner_from_url(url: &str) -> String {
    let trimmed = url.trim();

    // SSH: git@host:owner/repo
    if trimmed.starts_with("git@") {
        if let Some(colon_pos) = trimmed.find(':') {
            let path_part = &trimmed[colon_pos + 1..];
            let path_part = path_part.trim_end_matches(".git").trim_end_matches('/');
            if let Some(slash_pos) = path_part.find('/') {
                return path_part[..slash_pos].to_string();
            }
        }
    }

    // HTTPS
    if let Ok(parsed) = reqwest::Url::parse(trimmed) {
        if let Some(mut segments) = parsed.path_segments() {
            if let Some(owner) = segments.next() {
                return owner.to_string();
            }
        }
        return parsed.host_str().unwrap_or("unknown").to_string();
    }

    "unknown".to_string()
}

/// Strip embedded credentials (username:password@) from a URL for safe display/storage.
fn strip_credentials_from_url(url: &str) -> String {
    if let Ok(mut parsed) = reqwest::Url::parse(url) {
        let had_creds = !parsed.username().is_empty() || parsed.password().is_some();
        if had_creds {
            let _ = parsed.set_username("");
            let _ = parsed.set_password(None);
            return parsed.to_string();
        }
    }
    // For SSH URLs (git@host:path), credentials are part of the scheme and safe to display
    url.to_string()
}

/// Source field for DB: "github:owner/repo" or "git:url"
/// Credentials are stripped before storage.
fn build_source_field(host: &GitHost, repo: &GitHubRepoRef) -> String {
    match host {
        GitHost::GitHub => format!("github:{}/{}", repo.owner, repo.repo),
        GitHost::Generic => format!("git:{}", strip_credentials_from_url(&repo.normalized_url)),
    }
}

// ─── File Operations for Generic Git Repos ───────────────────────────────────

/// Collect source files from a local directory snapshot for a given skill source_path.
fn collect_local_source_files(
    files: &HashMap<String, Vec<u8>>,
    source_path: &str,
) -> Result<Vec<SnapshotSourceFile>, String> {
    let mut source_files = files
        .iter()
        .filter_map(|(path, bytes)| {
            let relative_path = if source_path == "." {
                path.clone()
            } else {
                let prefix = format!("{}/", source_path.trim_matches('/'));
                let relative = path.strip_prefix(&prefix)?;
                if relative.is_empty() {
                    return None;
                }
                relative.to_string()
            };

            Some(SnapshotSourceFile {
                repo_path: path.clone(),
                relative_path,
                byte_len: bytes.len(),
            })
        })
        .collect::<Vec<_>>();

    source_files.sort_by(|left, right| left.repo_path.cmp(&right.repo_path));

    if source_files.is_empty() {
        return Err(format!(
            "Repository path '{}' contains no files.",
            source_path
        ));
    }

    Ok(source_files)
}

/// Write files from a local snapshot to the target directory.
fn write_local_source_to_target(
    files: &HashMap<String, Vec<u8>>,
    source_files: &[SnapshotSourceFile],
    target_dir: &Path,
) -> Result<(), String> {
    std::fs::create_dir_all(target_dir)
        .map_err(|e| format!("Failed to create import target directory: {}", e))?;

    for file in source_files {
        if !is_safe_repo_relative_path(&file.relative_path) {
            return Err(format!(
                "Repository contains an unsupported path '{}'.",
                file.repo_path
            ));
        }

        let bytes = files.get(&file.repo_path).ok_or_else(|| {
            format!(
                "Repository file '{}' is no longer available in the snapshot.",
                file.repo_path
            )
        })?;

        let destination = target_dir.join(&file.relative_path);
        let parent = destination
            .parent()
            .ok_or_else(|| "Failed to determine imported file parent directory.".to_string())?;
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create imported file parent directory: {}", e))?;
        std::fs::write(&destination, bytes).map_err(|e| {
            format!(
                "Failed to write imported file '{}': {}",
                destination.display(),
                e
            )
        })?;
    }

    Ok(())
}

/// Build a file tree from a local directory for browsing.
fn build_file_entries_from_dir(
    dir: &Path,
    skill_path: &str,
) -> Result<Vec<RemoteSkillFileEntry>, String> {
    let skill_dir = if skill_path == "." {
        dir.to_path_buf()
    } else {
        dir.join(skill_path.trim_matches('/'))
    };

    if !skill_dir.is_dir() {
        return Err(format!(
            "Skill directory '{}' not found in cloned repository.",
            skill_path
        ));
    }

    let mut entries = Vec::new();
    collect_file_entries_recursive(&skill_dir, &skill_dir, &mut entries)?;
    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
    });
    Ok(entries)
}

fn collect_file_entries_recursive(
    base: &Path,
    current: &Path,
    entries: &mut Vec<RemoteSkillFileEntry>,
) -> Result<(), String> {
    let dir_entries = std::fs::read_dir(current)
        .map_err(|e| format!("Failed to read directory '{}': {}", current.display(), e))?;

    for entry in dir_entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // Skip .git directory
        if path.file_name().map(|n| n == ".git").unwrap_or(false) {
            continue;
        }

        let relative = path
            .strip_prefix(base)
            .map_err(|e| format!("Path prefix error: {}", e))?;
        let relative_str = relative.to_string_lossy().replace('\\', "/");
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();

        entries.push(RemoteSkillFileEntry {
            name,
            path: relative_str,
            is_dir: path.is_dir(),
        });

        if path.is_dir() {
            collect_file_entries_recursive(base, &path, entries)?;
        }
    }
    Ok(())
}

// ─── Unified Repo Import Result ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoImportResult {
    pub repo: GitHubRepoRef,
    pub host: GitHost,
    pub imported_skills: Vec<ImportedGitHubSkillSummary>,
    pub skipped_skills: Vec<String>,
}

// ─── Progress Emission ───────────────────────────────────────────────────────

fn emit_git_import_progress(app: Option<&AppHandle>, payload: GitHubImportProgressPayload) {
    if let Some(app) = app {
        let _ = app.emit("git-import:progress", payload);
    }
}

// ─── IPC Commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn preview_git_repo_import(
    state: State<'_, AppState>,
    repo_url: String,
    branch: Option<String>,
) -> Result<GitHubRepoPreview, String> {
    let host = detect_git_host(&repo_url);

    match host {
        GitHost::GitHub => {
            // Delegate to existing GitHub HTTP flow
            let (clean_url, url_branch) = extract_branch_from_url(&repo_url);
            let effective_url = if url_branch.is_some() { clean_url } else { repo_url.clone() };
            super::github_import::preview_github_repo_import_impl(&state.db, &effective_url).await
        }
        GitHost::Generic => {
            let (clean_url, url_branch) = extract_branch_from_url(&repo_url);
            let effective_branch = branch.as_deref().or(url_branch.as_deref());

            let temp_dir = clone_repo_to_temp(&clean_url, effective_branch)?;

            let files = snapshot_from_local_dir(temp_dir.path())?;
            let repo_ref = build_repo_ref_from_url(&clean_url, effective_branch)?;
            let candidates = build_candidates_from_local_snapshot(&clean_url, &files)?;

            if candidates.is_empty() {
                return Err(
                    "No importable skills found in this repository. Supported layouts are repo-root skill directories or a top-level skills/ directory."
                        .to_string(),
                );
            }

            let skills = build_preview_skills(&state.db, &candidates).await?;

            if skills.is_empty() {
                return Err("No importable skills found in this repository.".to_string());
            }

            Ok(GitHubRepoPreview {
                repo: repo_ref,
                skills,
            })
        }
    }
}

#[tauri::command]
pub async fn import_git_repo_skills(
    app: AppHandle,
    state: State<'_, AppState>,
    repo_url: String,
    branch: Option<String>,
    selections: Vec<GitHubSkillImportSelection>,
) -> Result<GitRepoImportResult, String> {
    let host = detect_git_host(&repo_url);

    match host {
        GitHost::GitHub => {
            // Delegate to existing GitHub HTTP flow
            let (clean_url, url_branch) = extract_branch_from_url(&repo_url);
            let effective_url = if url_branch.is_some() { clean_url } else { repo_url.clone() };
            let result = super::github_import::import_github_repo_skills_impl(
                &state.db,
                &effective_url,
                selections,
                Some(&app),
            )
            .await?;

            Ok(GitRepoImportResult {
                repo: result.repo,
                host: GitHost::GitHub,
                imported_skills: result.imported_skills,
                skipped_skills: result.skipped_skills,
            })
        }
        GitHost::Generic => {
            emit_git_import_progress(
                Some(&app),
                GitHubImportProgressPayload {
                    phase: GitHubImportProgressPhase::Preparing,
                    current_skill: None,
                    current_path: None,
                    completed_files: 0,
                    total_files: 0,
                    completed_bytes: 0,
                    total_bytes: 0,
                },
            );

            let (clean_url, url_branch) = extract_branch_from_url(&repo_url);
            let effective_branch = branch.as_deref().or(url_branch.as_deref());

            let temp_dir = clone_repo_to_temp(&clean_url, effective_branch)?;

            let files = snapshot_from_local_dir(temp_dir.path())?;

            let repo_ref = build_repo_ref_from_url(&clean_url, effective_branch)?;
            let source = build_source_field(&host, &repo_ref);

            let candidates = build_candidates_from_local_snapshot(&clean_url, &files)?;

            if candidates.is_empty() {
                return Err(
                    "No importable skills found in this repository.".to_string(),
                );
            }

            if selections.is_empty() {
                return Err("Select at least one skill to import.".to_string());
            }

            let mut selected_paths = HashSet::new();
            let mut selected = Vec::new();
            for selection in selections {
                let candidate = candidates
                    .iter()
                    .find(|c| c.source_path == selection.source_path)
                    .ok_or_else(|| {
                        format!(
                            "Selected skill '{}' is no longer available in the preview.",
                            selection.source_path
                        )
                    })?
                    .clone();

                if !selected_paths.insert(candidate.source_path.clone()) {
                    return Err(format!(
                        "Skill '{}' was selected more than once.",
                        candidate.source_path
                    ));
                }

                selected.push((candidate, selection));
            }

            let central_root = central_skills_root(&state.db).await?;
            std::fs::create_dir_all(&central_root)
                .map_err(|e| format!("Failed to create central skills directory: {}", e))?;

            let mut occupied_ids = current_central_skill_ids(&state.db).await?;

            let mut staging_ops = Vec::new();
            let mut skipped_skills = Vec::new();

            for (candidate, selection) in &selected {
                match selection.resolution {
                    DuplicateResolution::Skip => {
                        skipped_skills.push(candidate.source_path.clone());
                        continue;
                    }
                    DuplicateResolution::Overwrite => {
                        if let Some(existing) =
                            db::get_skill_by_id(&state.db, &candidate.skill_id).await?
                        {
                            if !existing.is_central {
                                return Err(format!(
                                    "Skill '{}' conflicts with a non-central record and cannot be overwritten safely.",
                                    candidate.skill_id
                                ));
                            }
                        }
                        occupied_ids.insert(candidate.skill_id.clone());
                        staging_ops.push(StagedLocalImport {
                            candidate: candidate.clone(),
                            final_skill_id: candidate.skill_id.clone(),
                            resolution: DuplicateResolution::Overwrite,
                            source_files: Vec::new(),
                        });
                    }
                    DuplicateResolution::Rename => {
                        let requested_id = sanitize_skill_id(
                            selection.renamed_skill_id.as_deref().ok_or_else(|| {
                                format!(
                                    "Skill '{}' requires a renamed skill id for rename resolution.",
                                    candidate.source_path
                                )
                            })?,
                        )?;
                        if occupied_ids.contains(&requested_id) {
                            return Err(format!(
                                "Renamed skill id '{}' is already in use.",
                                requested_id
                            ));
                        }
                        occupied_ids.insert(requested_id.clone());
                        staging_ops.push(StagedLocalImport {
                            candidate: candidate.clone(),
                            final_skill_id: requested_id,
                            resolution: DuplicateResolution::Rename,
                            source_files: Vec::new(),
                        });
                    }
                }
            }

            if staging_ops.is_empty() && skipped_skills.is_empty() {
                return Err("No valid import operations were requested.".to_string());
            }

            for op in &mut staging_ops {
                op.source_files =
                    collect_local_source_files(&files, &op.candidate.source_path)?;
            }

            let total_files: usize = staging_ops.iter().map(|op| op.source_files.len()).sum();
            let total_bytes: u64 = staging_ops
                .iter()
                .flat_map(|op| op.source_files.iter())
                .map(|f| f.byte_len as u64)
                .sum();

            emit_git_import_progress(
                Some(&app),
                GitHubImportProgressPayload {
                    phase: GitHubImportProgressPhase::Writing,
                    current_skill: None,
                    current_path: None,
                    completed_files: 0,
                    total_files,
                    completed_bytes: 0,
                    total_bytes,
                },
            );

            let mut imported_skills = Vec::new();
            let mut created_paths = Vec::new();
            let mut completed_files = 0usize;
            let mut completed_bytes = 0u64;

            for op in &staging_ops {
                let target_dir = central_root.join(&op.final_skill_id);
                if target_dir.exists() {
                    if op.resolution == DuplicateResolution::Overwrite {
                        std::fs::remove_dir_all(&target_dir).map_err(|e| {
                            format!(
                                "Failed to replace existing canonical skill '{}': {}",
                                op.final_skill_id, e
                            )
                        })?;
                    } else {
                        cleanup_created_directories(&created_paths);
                        return Err(format!(
                            "Target directory '{}' already exists.",
                            target_dir.display()
                        ));
                    }
                }

                if let Err(error) = write_local_source_to_target(
                    &files,
                    &op.source_files,
                    &target_dir,
                ) {
                    cleanup_created_directories(&created_paths);
                    if target_dir.exists() {
                        let _ = std::fs::remove_dir_all(&target_dir);
                    }
                    return Err(error);
                }

                created_paths.push(target_dir.clone());

                completed_files += op.source_files.len();
                completed_bytes += op.source_files.iter().map(|f| f.byte_len as u64).sum::<u64>();
                emit_git_import_progress(
                    Some(&app),
                    GitHubImportProgressPayload {
                        phase: GitHubImportProgressPhase::Writing,
                        current_skill: Some(op.candidate.source_path.clone()),
                        current_path: None,
                        completed_files,
                        total_files,
                        completed_bytes,
                        total_bytes,
                    },
                );

                let skill_md_path = target_dir.join("SKILL.md");
                let raw = std::fs::read_to_string(&skill_md_path)
                    .map_err(|e| format!("Failed to read imported SKILL.md: {}", e))?;
                let frontmatter = parse_frontmatter(&raw).ok_or_else(|| {
                    format!(
                        "Imported skill '{}' is missing valid frontmatter.",
                        op.candidate.source_path
                    )
                })?;

                let db_skill = Skill {
                    id: op.final_skill_id.clone(),
                    name: frontmatter.name.clone(),
                    description: frontmatter.description.clone(),
                    file_path: skill_md_path.to_string_lossy().into_owned(),
                    canonical_path: Some(target_dir.to_string_lossy().into_owned()),
                    is_central: true,
                    source: Some(source.clone()),
                    content: None,
                    scanned_at: Utc::now().to_rfc3339(),
                    source_ref: None,
                    source_path: Some(op.candidate.source_path.clone()),
                    source_branch: Some(repo_ref.branch.clone()),
                };
                db::upsert_skill(&state.db, &db_skill).await?;

                imported_skills.push(ImportedGitHubSkillSummary {
                    source_path: op.candidate.source_path.clone(),
                    original_skill_id: op.candidate.skill_id.clone(),
                    imported_skill_id: op.final_skill_id.clone(),
                    skill_name: frontmatter.name,
                    target_directory: target_dir.to_string_lossy().into_owned(),
                    resolution: op.resolution.clone(),
                });
            }

            emit_git_import_progress(
                Some(&app),
                GitHubImportProgressPayload {
                    phase: GitHubImportProgressPhase::Finalizing,
                    current_skill: None,
                    current_path: None,
                    completed_files,
                    total_files,
                    completed_bytes,
                    total_bytes,
                },
            );

            Ok(GitRepoImportResult {
                repo: repo_ref,
                host: GitHost::Generic,
                imported_skills,
                skipped_skills,
            })
        }
    }
}

#[derive(Debug, Clone)]
struct StagedLocalImport {
    candidate: RemoteSkillCandidate,
    final_skill_id: String,
    resolution: DuplicateResolution,
    source_files: Vec<SnapshotSourceFile>,
}

fn cleanup_created_directories(paths: &[PathBuf]) {
    for path in paths.iter().rev() {
        let _ = std::fs::remove_dir_all(path);
    }
}

#[tauri::command]
pub async fn browse_git_skill_directory(
    state: State<'_, AppState>,
    repo_url: String,
    branch: Option<String>,
    skill_path: String,
) -> Result<Vec<RemoteSkillFileEntry>, String> {
    let host = detect_git_host(&repo_url);

    match host {
        GitHost::GitHub => {
            // For GitHub, use the existing API-based browsing if we have a raw URL.
            // The frontend may pass the download_url from the preview.
            // If the URL looks like a raw.githubusercontent.com URL, use the existing command.
            if repo_url.starts_with("https://raw.githubusercontent.com/") {
                return super::github_import::browse_github_skill_directory(
                    state,
                    repo_url,
                )
                .await;
            }
            // Otherwise, fall back to git clone approach
            let (clean_url, url_branch) = extract_branch_from_url(&repo_url);
            let effective_branch = branch.as_deref().or(url_branch.as_deref());
            let temp_dir = clone_repo_to_temp(&clean_url, effective_branch)?;
            build_file_entries_from_dir(temp_dir.path(), &skill_path)
        }
        GitHost::Generic => {
            let (clean_url, url_branch) = extract_branch_from_url(&repo_url);
            let effective_branch = branch.as_deref().or(url_branch.as_deref());
            let temp_dir = clone_repo_to_temp(&clean_url, effective_branch)?;
            build_file_entries_from_dir(temp_dir.path(), &skill_path)
        }
    }
}

#[tauri::command]
pub async fn fetch_git_skill_markdown(
    state: State<'_, AppState>,
    repo_url: String,
    branch: Option<String>,
    file_path: String,
) -> Result<String, String> {
    let host = detect_git_host(&repo_url);

    match host {
        GitHost::GitHub => {
            // For GitHub, if the URL is already a raw.githubusercontent.com URL,
            // use the existing command.
            if repo_url.starts_with("https://raw.githubusercontent.com/") {
                return super::github_import::fetch_github_skill_markdown(state, repo_url).await;
            }
            // Otherwise, construct the raw URL from the repo info
            let (clean_url, _) = extract_branch_from_url(&repo_url);
            if let Ok((owner, repo)) = super::github_import::parse_github_url(&clean_url) {
                let auth =
                    super::github_import::github_direct_auth_from_settings(&state.db).await?;
                let repo_ref = super::github_import::resolve_repo_ref(&clean_url, auth.as_deref())
                    .await
                    .ok();
                let branch_str = repo_ref
                    .as_ref()
                    .map(|r| r.branch.as_str())
                    .unwrap_or("main");
                let raw_url = format!(
                    "https://raw.githubusercontent.com/{}/{}/{}/{}",
                    owner, repo, branch_str, file_path
                );
                return super::github_import::fetch_github_skill_markdown(state, raw_url).await;
            }
            // Fallback to git clone approach
            let (clean_url, url_branch) = extract_branch_from_url(&repo_url);
            let effective_branch = branch.as_deref().or(url_branch.as_deref());
            let temp_dir = clone_repo_to_temp(&clean_url, effective_branch)?;
            let full_path = temp_dir.path().join(&file_path);
            std::fs::read_to_string(&full_path).map_err(|e| {
                format!("Failed to read file '{}': {}", file_path, e)
            })
        }
        GitHost::Generic => {
            let (clean_url, url_branch) = extract_branch_from_url(&repo_url);
            let effective_branch = branch.as_deref().or(url_branch.as_deref());
            let temp_dir = clone_repo_to_temp(&clean_url, effective_branch)?;
            let full_path = temp_dir.path().join(&file_path);
            std::fs::read_to_string(&full_path).map_err(|e| {
                format!("Failed to read file '{}': {}", file_path, e)
            })
        }
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_git_host_identifies_github() {
        assert_eq!(
            detect_git_host("https://github.com/owner/repo"),
            GitHost::GitHub
        );
        assert_eq!(
            detect_git_host("git@github.com:owner/repo.git"),
            GitHost::GitHub
        );
    }

    #[test]
    fn detect_git_host_identifies_generic() {
        assert_eq!(
            detect_git_host("https://gitlab.com/owner/repo"),
            GitHost::Generic
        );
        assert_eq!(
            detect_git_host("https://bitbucket.org/owner/repo"),
            GitHost::Generic
        );
        assert_eq!(
            detect_git_host("https://git.example.com/team/project"),
            GitHost::Generic
        );
        assert_eq!(
            detect_git_host("git@gitlab.com:owner/repo.git"),
            GitHost::Generic
        );
    }

    #[test]
    fn extract_branch_from_url_parses_hash_suffix() {
        let (url, branch) = extract_branch_from_url("https://gitlab.com/owner/repo#develop");
        assert_eq!(url, "https://gitlab.com/owner/repo");
        assert_eq!(branch, Some("develop".to_string()));
    }

    #[test]
    fn extract_branch_from_url_no_branch() {
        let (url, branch) = extract_branch_from_url("https://gitlab.com/owner/repo");
        assert_eq!(url, "https://gitlab.com/owner/repo");
        assert_eq!(branch, None);
    }

    #[test]
    fn extract_repo_name_from_https_url() {
        assert_eq!(
            extract_repo_name_from_url("https://gitlab.com/owner/my-project"),
            "my-project"
        );
        assert_eq!(
            extract_repo_name_from_url("https://gitlab.com/owner/my-project.git"),
            "my-project"
        );
        assert_eq!(
            extract_repo_name_from_url("https://github.com/anthropics/skills"),
            "skills"
        );
    }

    #[test]
    fn extract_repo_name_from_ssh_url() {
        assert_eq!(
            extract_repo_name_from_url("git@gitlab.com:owner/my-project.git"),
            "my-project"
        );
        assert_eq!(
            extract_repo_name_from_url("git@github.com:owner/repo"),
            "repo"
        );
    }

    #[test]
    fn extract_owner_from_urls() {
        assert_eq!(
            extract_owner_from_url("https://gitlab.com/myteam/project"),
            "myteam"
        );
        assert_eq!(
            extract_owner_from_url("git@gitlab.com:myteam/project.git"),
            "myteam"
        );
    }

    #[test]
    fn build_source_field_formats_correctly() {
        let repo = GitHubRepoRef {
            owner: "owner".to_string(),
            repo: "project".to_string(),
            branch: "main".to_string(),
            normalized_url: "https://github.com/owner/project".to_string(),
        };
        assert_eq!(
            build_source_field(&GitHost::GitHub, &repo),
            "github:owner/project"
        );

        let repo2 = GitHubRepoRef {
            owner: "team".to_string(),
            repo: "project".to_string(),
            branch: "main".to_string(),
            normalized_url: "https://gitlab.com/team/project".to_string(),
        };
        assert_eq!(
            build_source_field(&GitHost::Generic, &repo2),
            "git:https://gitlab.com/team/project"
        );
    }

    #[test]
    fn build_candidates_from_local_snapshot_classifies_skills() {
        let mut files = HashMap::new();
        files.insert(
            "skills/demo/SKILL.md".to_string(),
            b"---\nname: Demo\ndescription: A demo skill\n---\n\n# Demo\n".to_vec(),
        );
        files.insert(
            "skills/demo/README.md".to_string(),
            b"# demo readme\n".to_vec(),
        );
        files.insert(
            "SKILL.md".to_string(),
            b"---\nname: Root Skill\ndescription: Root\n---\n\n# Root\n".to_vec(),
        );

        let candidates =
            build_candidates_from_local_snapshot("https://gitlab.com/owner/repo", &files)
                .expect("candidates");

        assert_eq!(candidates.len(), 2);

        let root = candidates
            .iter()
            .find(|c| c.source_path == ".")
            .expect("root skill");
        assert_eq!(root.skill_id, "repo");
        assert_eq!(root.skill_name, "Root Skill");

        let demo = candidates
            .iter()
            .find(|c| c.source_path == "skills/demo")
            .expect("demo skill");
        assert_eq!(demo.skill_id, "demo");
        assert_eq!(demo.skill_name, "Demo");
    }
}
