use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::State;

use crate::path_utils::{app_data_dir, central_skills_dir};
use crate::{db, AppState};

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case", tag = "status")]
pub enum UpdateStatus {
    UpToDate,
    UpdateAvailable {
        latest_sha: String,
        latest_message: String,
        latest_date: String,
    },
    CheckFailed {
        error: String,
    },
    NotApplicable,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillUpdateStatus {
    pub skill_id: String,
    pub update_status: UpdateStatus,
}

// ─── Check Updates ────────────────────────────────────────────────────────────

/// Cache TTL in minutes for update check results.
const CACHE_TTL_MINUTES: i64 = 15;

#[tauri::command]
pub async fn check_skill_updates(
    state: State<'_, AppState>,
    skill_ids: Vec<String>,
) -> Result<Vec<SkillUpdateStatus>, String> {
    check_skill_updates_impl(&state.db, &skill_ids).await
}

async fn check_skill_updates_impl(
    pool: &db::DbPool,
    skill_ids: &[String],
) -> Result<Vec<SkillUpdateStatus>, String> {
    let mut results = Vec::with_capacity(skill_ids.len());

    // Group skills by repo (owner/repo) to minimize API calls.
    let mut repo_skills: HashMap<String, Vec<(String, Option<String>, Option<String>)>> =
        HashMap::new(); // repo_key → [(skill_id, source_ref, source_path)]

    for skill_id in skill_ids {
        let skill = db::get_skill_by_id(pool, skill_id).await?;
        let Some(skill) = skill else {
            results.push(SkillUpdateStatus {
                skill_id: skill_id.clone(),
                update_status: UpdateStatus::NotApplicable,
            });
            continue;
        };

        // Check cache first
        if let Some(cache) = db::get_update_check_cache(pool, skill_id).await? {
            let checked = chrono::DateTime::parse_from_rfc3339(&cache.checked_at);
            if let Ok(checked) = checked {
                let elapsed = Utc::now().signed_duration_since(checked.with_timezone(&Utc));
                if elapsed.num_minutes() < CACHE_TTL_MINUTES {
                    let status: UpdateStatus = if let Some(error) = &cache.error_message {
                        UpdateStatus::CheckFailed {
                            error: error.clone(),
                        }
                    } else if cache.has_update == Some(true) {
                        // Cached "update available" — re-check for fresh data
                        // Fall through to re-check below
                        UpdateStatus::NotApplicable // sentinel, won't be used
                    } else if cache.has_update == Some(false) {
                        UpdateStatus::UpToDate
                    } else {
                        UpdateStatus::NotApplicable
                    };

                    // If we got a definitive answer, use it
                    if !matches!(status, UpdateStatus::NotApplicable) {
                        results.push(SkillUpdateStatus {
                            skill_id: skill_id.clone(),
                            update_status: status,
                        });
                        continue;
                    }
                }
            }
        }

        let Some((kind, repo)) = db::parse_source(&skill.source) else {
            results.push(SkillUpdateStatus {
                skill_id: skill_id.clone(),
                update_status: UpdateStatus::NotApplicable,
            });
            continue;
        };

        // Only github and skills.sh sources support update checking
        if kind != "github" && kind != "skills.sh" {
            results.push(SkillUpdateStatus {
                skill_id: skill_id.clone(),
                update_status: UpdateStatus::NotApplicable,
            });
            continue;
        }

        repo_skills
            .entry(repo.to_string())
            .or_default()
            .push((skill_id.clone(), skill.source_ref, skill.source_path));
    }

    // For each repo, fetch the latest commit and compare
    for (repo_key, skills) in repo_skills {
        let parts: Vec<&str> = repo_key.split('/').collect();
        if parts.len() != 2 {
            for (skill_id, _, _) in &skills {
                results.push(SkillUpdateStatus {
                    skill_id: skill_id.clone(),
                    update_status: UpdateStatus::CheckFailed {
                        error: format!("Invalid repo key: {}", repo_key),
                    },
                });
            }
            continue;
        }

        let owner = parts[0];
        let repo_name = parts[1];

        // Get auth token
        let auth = db::get_setting(pool, "github_pat")
            .await?
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty());

        // For each skill in this repo, check the latest commit on its path
        for (skill_id, source_ref, source_path) in &skills {
            let status = check_single_skill(
                pool,
                owner,
                repo_name,
                skill_id,
                source_ref.as_deref(),
                source_path.as_deref(),
                auth.as_deref(),
            )
            .await;

            // Cache the result
            let now = Utc::now().to_rfc3339();
            let cache_entry = db::UpdateCheckCacheEntry {
                skill_id: skill_id.clone(),
                checked_at: now,
                latest_sha: match &status {
                    UpdateStatus::UpdateAvailable { latest_sha, .. } => Some(latest_sha.clone()),
                    _ => None,
                },
                has_update: Some(matches!(
                    status,
                    UpdateStatus::UpdateAvailable { .. }
                )),
                error_message: match &status {
                    UpdateStatus::CheckFailed { error } => Some(error.clone()),
                    _ => None,
                },
            };
            let _ = db::upsert_update_check_cache(pool, &cache_entry).await;

            results.push(SkillUpdateStatus {
                skill_id: skill_id.clone(),
                update_status: status,
            });
        }
    }

    Ok(results)
}

async fn check_single_skill(
    _pool: &db::DbPool,
    owner: &str,
    repo_name: &str,
    _skill_id: &str,
    source_ref: Option<&str>,
    source_path: Option<&str>,
    auth: Option<&str>,
) -> UpdateStatus {
    let client = match reqwest::Client::builder()
        .user_agent("skill-link/0.9.1")
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return UpdateStatus::CheckFailed {
                error: format!("HTTP client error: {}", e),
            }
        }
    };

    // Build commits API URL
    let path_param = source_path
        .filter(|p| !p.is_empty() && p != &".")
        .unwrap_or("");
    let commits_url = if path_param.is_empty() {
        format!(
            "https://api.github.com/repos/{}/{}/commits?per_page=1",
            owner, repo_name
        )
    } else {
        format!(
            "https://api.github.com/repos/{}/{}/commits?per_page=1&path={}",
            owner, repo_name, path_param
        )
    };

    let response = match super::github_import::send_with_auth_fallback(
        &client,
        &commits_url,
        auth,
    )
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return UpdateStatus::CheckFailed {
                error: format!("GitHub API request failed: {}", e),
            }
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        return UpdateStatus::CheckFailed {
            error: format!("GitHub API returned HTTP {}", status),
        };
    }

    let commits: Vec<serde_json::Value> = match response.json().await {
        Ok(v) => v,
        Err(e) => {
            return UpdateStatus::CheckFailed {
                error: format!("Failed to parse commits response: {}", e),
            }
        }
    };

    let latest_commit = match commits.first() {
        Some(c) => c,
        None => {
            return UpdateStatus::CheckFailed {
                error: "No commits found for this path".to_string(),
            }
        }
    };

    let latest_sha = latest_commit
        .get("sha")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let latest_message = latest_commit
        .get("commit")
        .and_then(|c| c.get("message"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("")
        .to_string();

    let latest_date = latest_commit
        .get("commit")
        .and_then(|c| c.get("committer"))
        .and_then(|c| c.get("date"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Compare with installed SHA
    match source_ref {
        Some(installed_sha) if !installed_sha.is_empty() => {
            if installed_sha == latest_sha {
                UpdateStatus::UpToDate
            } else {
                UpdateStatus::UpdateAvailable {
                    latest_sha,
                    latest_message,
                    latest_date,
                }
            }
        }
        // No source_ref = installed before tracking was added = assume update available
        _ => UpdateStatus::UpdateAvailable {
            latest_sha,
            latest_message,
            latest_date,
        },
    }
}

// ─── Update Skill ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn update_skill(
    state: State<'_, AppState>,
    skill_id: String,
) -> Result<String, String> {
    update_skill_impl(&state.db, &skill_id).await
}

async fn update_skill_impl(pool: &db::DbPool, skill_id: &str) -> Result<String, String> {
    let skill = db::get_skill_by_id(pool, skill_id)
        .await?
        .ok_or_else(|| format!("Skill '{}' not found", skill_id))?;

    let Some((kind, repo_key)) = db::parse_source(&skill.source) else {
        return Err("Skill does not have a remote source".to_string());
    };

    if kind != "github" && kind != "skills.sh" {
        return Err(format!("Unsupported source type: {}", kind));
    }

    let parts: Vec<&str> = repo_key.split('/').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid repo key: {}", repo_key));
    }

    let owner = parts[0];
    let repo_name = parts[1];
    let repo_url = format!("https://github.com/{}/{}", owner, repo_name);

    // Get auth token
    let auth = super::github_import::github_direct_auth_from_settings(pool).await?;

    // Resolve the repo ref (resolves default branch)
    let repo = super::github_import::resolve_repo_ref(&repo_url, auth.as_deref()).await?;
    let client = super::github_import::github_client()?;

    // Download the latest snapshot
    let snapshot =
        super::github_import::download_repo_snapshot(&client, &repo, auth.as_deref()).await?;

    // Determine the source_path in the repo
    let source_path = skill
        .source_path
        .as_deref()
        .filter(|p| !p.is_empty())
        .unwrap_or(".");

    // Collect files from the snapshot
    let source_files =
        super::github_import::collect_snapshot_source_files(&snapshot, source_path)?;

    // Resolve the latest commit SHA
    let latest_sha = fetch_latest_commit_sha(
        &client,
        owner,
        repo_name,
        source_path,
        auth.as_deref(),
    )
    .await?;

    // Get the central root and skill directory
    let central_root = central_skills_dir();
    let skill_dir = central_root.join(skill_id);

    if !skill_dir.exists() {
        return Err(format!(
            "Skill directory '{}' does not exist",
            skill_dir.display()
        ));
    }

    // 1. Backup current directory
    backup_skill_dir(skill_id)?;

    // 2. Write to temp directory
    let temp_dir = central_root.join(format!(".tmp-update-{}", skill_id));
    if temp_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    let mut progress_state = super::github_import::GitHubImportProgressState::default();
    super::github_import::write_snapshot_source_to_target(
        &snapshot,
        &source_files,
        &temp_dir,
        source_path,
        &mut progress_state,
        None,
    )?;

    // 3. Validate: temp dir must have SKILL.md
    if !temp_dir.join("SKILL.md").exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("Updated skill is missing SKILL.md — aborting".to_string());
    }

    // 4. Re-parse frontmatter from the updated content
    let updated_content = std::fs::read_to_string(temp_dir.join("SKILL.md"))
        .map_err(|e| format!("Failed to read updated SKILL.md: {}", e))?;
    let frontmatter = super::github_import::parse_frontmatter(&updated_content)
        .ok_or_else(|| "Updated SKILL.md is missing valid frontmatter".to_string())?;

    // 5. Atomic swap: rename current → backup_staging, temp → current
    let backup_staging = central_root.join(format!(".backup-staging-{}", skill_id));
    // Remove stale staging if exists
    let _ = std::fs::remove_dir_all(&backup_staging);

    if let Err(_e) = std::fs::rename(&skill_dir, &backup_staging) {
        // rename might fail if cross-filesystem; fall back to copy+delete
        copy_dir_all(&skill_dir, &backup_staging)?;
        let _ = std::fs::remove_dir_all(&skill_dir);
    }

    match std::fs::rename(&temp_dir, &skill_dir) {
        Ok(_) => {
            // Success: clean up
            let _ = std::fs::remove_dir_all(&backup_staging);
        }
        Err(e) => {
            // Rollback: restore from backup_staging
            let _ = std::fs::remove_dir_all(&skill_dir);
            let _ = std::fs::rename(&backup_staging, &skill_dir);
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err(format!("Failed to activate updated skill: {}", e));
        }
    }

    // 6. Update DB with new source_ref and frontmatter
    if let Some(ref sha) = latest_sha {
        db::update_skill_source_ref(
            pool,
            skill_id,
            sha,
            &frontmatter.name,
            frontmatter.description.as_deref(),
        )
        .await?;
    }

    // 7. Clean old backups (keep last 3)
    cleanup_old_backups(skill_id, 3)?;

    Ok(skill_id.to_string())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async fn fetch_latest_commit_sha(
    client: &reqwest::Client,
    owner: &str,
    repo_name: &str,
    source_path: &str,
    auth: Option<&str>,
) -> Result<Option<String>, String> {
    let commits_url = if source_path == "." || source_path.is_empty() {
        format!(
            "https://api.github.com/repos/{}/{}/commits?per_page=1",
            owner, repo_name
        )
    } else {
        format!(
            "https://api.github.com/repos/{}/{}/commits?per_page=1&path={}",
            owner, repo_name, source_path
        )
    };

    let response = super::github_import::send_with_auth_fallback(client, &commits_url, auth)
        .await
        .map_err(|e| format!("Failed to fetch commit SHA: {}", e))?;

    if !response.status().is_success() {
        return Ok(None);
    }

    let commits: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse commits: {}", e))?;

    Ok(commits
        .first()
        .and_then(|c| c.get("sha"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string()))
}

fn backup_skill_dir(skill_id: &str) -> Result<(), String> {
    let central_root = central_skills_dir();
    let skill_dir = central_root.join(skill_id);

    if !skill_dir.exists() {
        return Ok(());
    }

    let backup_root = app_data_dir().join("backups");
    std::fs::create_dir_all(&backup_root)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    let timestamp = Utc::now().format("%Y%m%dT%H%M%SZ");
    let backup_dir = backup_root.join(format!("{}_{}", skill_id, timestamp));

    copy_dir_all(&skill_dir, &backup_dir)?;

    Ok(())
}

fn cleanup_old_backups(skill_id: &str, keep: usize) -> Result<(), String> {
    let backup_root = app_data_dir().join("backups");
    if !backup_root.exists() {
        return Ok(());
    }

    let mut backups: Vec<String> = std::fs::read_dir(&backup_root)
        .map_err(|e| format!("Failed to read backup directory: {}", e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with(&format!("{}_", skill_id)) {
                Some(name)
            } else {
                None
            }
        })
        .collect();

    if backups.len() <= keep {
        return Ok(());
    }

    // Sort by name (which includes timestamp, so chronological)
    backups.sort();

    // Remove oldest entries beyond `keep`
    for old_backup in &backups[..backups.len() - keep] {
        let path = backup_root.join(old_backup);
        let _ = std::fs::remove_dir_all(&path);
    }

    Ok(())
}

/// Recursively copy a directory and all its contents.
fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    std::fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create directory '{}': {}", dst.display(), e))?;

    for entry in std::fs::read_dir(src).map_err(|e| format!("Failed to read dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read dir entry: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path).map_err(|e| {
                format!(
                    "Failed to copy '{}' to '{}': {}",
                    src_path.display(),
                    dst_path.display(),
                    e
                )
            })?;
        }
    }

    Ok(())
}

// ─── Link Skill to GitHub ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkSkillToGitHubRequest {
    pub skill_id: String,
    pub repo_url: String,
    /// Path within the repository (e.g. "skills/my-skill"). Empty = repo root.
    pub source_path: Option<String>,
    /// Branch to track. None = default branch.
    pub branch: Option<String>,
}

/// Fetch a single file from GitHub Contents API.
/// Returns the decoded file content, or None if the file doesn't exist (404).
async fn fetch_remote_file_content(
    client: &reqwest::Client,
    owner: &str,
    repo_name: &str,
    file_path: &str,
    branch: Option<&str>,
    auth: Option<&str>,
) -> Result<Option<String>, String> {
    let mut url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}",
        owner, repo_name, file_path
    );
    if let Some(b) = branch {
        url = format!("{}?ref={}", url, b);
    }

    let response = super::github_import::send_with_auth_fallback(client, &url, auth)
        .await
        .map_err(|e| format!("Failed to fetch remote file: {}", e))?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Ok(None);
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Contents API response: {}", e))?;

    // Contents API returns base64-encoded "content" field
    let encoded = body
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    use base64::Engine;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(encoded.replace('\n', ""))
        .map_err(|e| format!("Failed to decode base64 content: {}", e))?;

    String::from_utf8(decoded)
        .map(Some)
        .map_err(|e| format!("Remote file is not valid UTF-8: {}", e))
}

/// Normalize text for comparison: trim trailing whitespace per line + trailing newlines.
fn normalize_for_comparison(s: &str) -> String {
    s.lines()
        .map(|line| line.trim_end())
        .collect::<Vec<_>>()
        .join("\n")
        .trim_end()
        .to_string()
}

#[tauri::command]
pub async fn link_skill_to_github(
    state: State<'_, AppState>,
    req: LinkSkillToGitHubRequest,
) -> Result<db::Skill, String> {
    let skill = db::get_skill_by_id(&state.db, &req.skill_id)
        .await?
        .ok_or_else(|| format!("Skill '{}' not found", req.skill_id))?;

    // Parse owner/repo from URL
    let (owner, repo_name) = super::github_import::parse_github_url(&req.repo_url)?;

    // Build source string
    let source = format!("github:{}/{}", owner, repo_name);

    // Resolve source_path and branch
    let source_path = req.source_path.as_deref().filter(|p| !p.is_empty());
    let source_branch = req.branch.as_deref().filter(|b| !b.is_empty());

    // Verify repo is reachable and fetch latest commit SHA
    let client = super::github_import::github_client()?;
    let auth = super::github_import::github_direct_auth_from_settings(&state.db).await?;

    let path_for_api = source_path.unwrap_or(".");
    let latest_sha = fetch_latest_commit_sha(
        &client,
        &owner,
        &repo_name,
        path_for_api,
        auth.as_deref(),
    )
    .await?;

    let latest_sha = latest_sha.ok_or_else(|| {
        "Could not verify repository or path. Please check the URL and path.".to_string()
    })?;

    // Compare remote SKILL.md with local to decide source_ref
    let skill_md_path = source_path
        .map(|p| format!("{}/SKILL.md", p.trim_matches('/')))
        .unwrap_or_else(|| "SKILL.md".to_string());

    let remote_content = fetch_remote_file_content(
        &client,
        &owner,
        &repo_name,
        &skill_md_path,
        source_branch,
        auth.as_deref(),
    )
    .await?;

    let local_content = std::fs::read_to_string(Path::new(&skill.file_path)).ok();

    // If remote and local SKILL.md match, mark as up-to-date; otherwise leave source_ref
    // empty so that check_skill_updates reports UpdateAvailable
    let source_ref = match (remote_content, local_content) {
        (Some(remote), Some(local))
            if normalize_for_comparison(&remote) == normalize_for_comparison(&local) =>
        {
            Some(latest_sha.clone())
        }
        _ => None,
    };

    // Persist to DB
    db::update_skill_source(
        &state.db,
        &req.skill_id,
        &source,
        source_path,
        source_branch,
        source_ref.as_deref(),
    )
    .await?;

    // Return updated skill
    db::get_skill_by_id(&state.db, &req.skill_id)
        .await?
        .ok_or_else(|| "Skill disappeared after update".to_string())
}
