import { invoke, isTauriRuntime } from "@/lib/tauri";
import type { SkillsShFileEntry } from "@/types";

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/";

export async function fetchRemoteText(downloadUrl: string): Promise<string> {
  if (isTauriRuntime() && downloadUrl.startsWith(GITHUB_RAW_BASE)) {
    return invoke<string>("fetch_github_skill_markdown", { downloadUrl });
  }

  const resp = await fetch(downloadUrl);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return resp.text();
}

export function canUseGithubSkillDirectory(downloadUrl: string): boolean {
  return downloadUrl.startsWith(GITHUB_RAW_BASE) && /\/SKILL\.md(?:[#?].*)?$/i.test(downloadUrl);
}

export async function browseRemoteSkillDirectory(downloadUrl: string): Promise<SkillsShFileEntry[]> {
  if (!isTauriRuntime() || !canUseGithubSkillDirectory(downloadUrl)) {
    return [];
  }
  return invoke<SkillsShFileEntry[]>("browse_github_skill_directory", { downloadUrl });
}

export async function installRemoteSkillDirectory(downloadUrl: string): Promise<string | null> {
  if (!isTauriRuntime() || !canUseGithubSkillDirectory(downloadUrl)) {
    return null;
  }
  return invoke<string>("install_github_skill_directory", { downloadUrl });
}
