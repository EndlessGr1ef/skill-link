import { create } from "zustand";
import { invoke, isTauriRuntime } from "@/lib/tauri";
import { AgentWithStatus, BatchInstallResult, SkillUpdateStatus, SkillWithLinks, UpdateStatus } from "@/types";

export const BROWSER_FIXTURE_AGENTS: AgentWithStatus[] = [
  {
    id: "claude-code",
    display_name: "Claude Code",
    category: "coding",
    global_skills_dir: "~/.claude/skills/",
    is_detected: true,
    is_builtin: true,
    is_enabled: true,
  },
  {
    id: "cursor",
    display_name: "Cursor",
    category: "coding",
    global_skills_dir: "~/.cursor/skills/",
    is_detected: true,
    is_builtin: true,
    is_enabled: true,
  },
  {
    id: "central",
    display_name: "Central Skills",
    category: "central",
    global_skills_dir: "~/.agents/skills/",
    is_detected: true,
    is_builtin: true,
    is_enabled: true,
  },
];

export const BROWSER_FIXTURE_SKILLS: SkillWithLinks[] = [
  {
    id: "fixture-central-skill",
    name: "fixture-central-skill",
    description: "Browser validation fixture for Central and drawer entry flows.",
    file_path: "~/.agents/skills/fixture-central-skill/SKILL.md",
    canonical_path: "~/.agents/skills/fixture-central-skill",
    is_central: true,
    source: "browser-fixture",
    scanned_at: "2026-04-17T00:00:00.000Z",
    created_at: "2026-04-17T00:00:00.000Z",
    updated_at: "2026-04-17T00:00:00.000Z",
    linked_agents: ["claude-code"],
  },
];

// ─── State ────────────────────────────────────────────────────────────────────

interface CentralSkillsState {
  skills: SkillWithLinks[];
  agents: AgentWithStatus[];
  isLoading: boolean;
  isInstalling: boolean;
  isDeleting: boolean;
  /** Agent ID currently being toggled (null = idle). */
  togglingAgentId: string | null;
  error: string | null;

  // ── Update detection ──
  /** Per-skill update status (keyed by skill_id). */
  updateStatuses: Record<string, UpdateStatus>;
  /** True while check_skill_updates is in flight. */
  isCheckingUpdates: boolean;
  /** Skill ID currently being updated (null = idle). */
  updatingSkillId: string | null;

  // Actions
  loadCentralSkills: () => Promise<void>;
  installSkill: (
    skillId: string,
    agentIds: string[],
    method: string
  ) => Promise<BatchInstallResult>;
  importToCentral: (skillId: string) => Promise<void>;
  togglePlatformLink: (skillId: string, agentId: string) => Promise<void>;
  deleteSkill: (skillId: string) => Promise<void>;
  checkUpdates: (skillIds?: string[]) => Promise<SkillUpdateStatus[]>;
  updateSkill: (skillId: string) => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCentralSkillsStore = create<CentralSkillsState>((set, get) => ({
  skills: [],
  agents: [],
  isLoading: false,
  isInstalling: false,
  isDeleting: false,
  togglingAgentId: null,
  error: null,
  updateStatuses: {},
  isCheckingUpdates: false,
  updatingSkillId: null,

  /**
   * Load all Central Skills with per-platform link status, along with the
   * list of all registered agents. Called when navigating to /central.
   */
  loadCentralSkills: async () => {
    set({ isLoading: true, error: null });
    if (!isTauriRuntime()) {
      set({
        skills: BROWSER_FIXTURE_SKILLS,
        agents: BROWSER_FIXTURE_AGENTS,
        isLoading: false,
      });
      return;
    }
    try {
      const [skills, agents] = await Promise.all([
        invoke<SkillWithLinks[]>("get_central_skills"),
        invoke<AgentWithStatus[]>("get_agents"),
      ]);
      set({ skills: skills ?? [], agents: agents ?? [], isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  /**
   * Install a skill to one or more agents. Refreshes the skill list after
   * a successful (or partial) install so link status icons update.
   */
  installSkill: async (skillId, agentIds, method) => {
    set({ isInstalling: true, error: null });
    try {
      const result = await invoke<BatchInstallResult>("batch_install_to_agents", {
        skillId,
        agentIds,
        method,
      });

      // Refresh central skills to get updated link status.
      const skills = await invoke<SkillWithLinks[]>("get_central_skills");
      set({ skills, isInstalling: false });

      return result;
    } catch (err) {
      set({ error: String(err), isInstalling: false });
      throw err;
    }
  },

  /**
   * Import a skill to the central skills directory.
   * Used when a skill exists in a custom scan directory but is not yet centralized.
   */
  importToCentral: async (skillId) => {
    set({ isInstalling: true, error: null });
    try {
      await invoke("import_skill_to_central", { skillId });
      const skills = await invoke<SkillWithLinks[]>("get_central_skills");
      set({ skills, isInstalling: false });
    } catch (err) {
      set({ error: String(err), isInstalling: false });
      throw err;
    }
  },

  /**
   * Toggle a single platform link for a skill.
   * If linked, uninstalls; if not linked, installs via the backend default method.
   * Refreshes the skill list afterward so linked_agents updates.
   */
  togglePlatformLink: async (skillId, agentId) => {
    set({ togglingAgentId: agentId, error: null });
    try {
      const skill = get().skills.find((s) => s.id === skillId);
      const isLinked = skill?.linked_agents.includes(agentId) ?? false;

      if (isLinked) {
        await invoke("uninstall_skill_from_agent", { skillId, agentId });
      } else {
        await invoke("install_skill_to_agent", { skillId, agentId, method: "auto" });
      }

      const skills = await invoke<SkillWithLinks[]>("get_central_skills");
      set({ skills, togglingAgentId: null });
    } catch (err) {
      set({ error: String(err), togglingAgentId: null });
      throw err;
    }
  },

  deleteSkill: async (skillId) => {
    set({ isDeleting: true, error: null });
    if (!isTauriRuntime()) {
      set({ skills: BROWSER_FIXTURE_SKILLS.filter((s) => s.id !== skillId), isDeleting: false });
      return;
    }
    try {
      await invoke("delete_skill_from_central", { skillId });
      const skills = await invoke<SkillWithLinks[]>("get_central_skills");
      set({ skills, isDeleting: false });
    } catch (err) {
      set({ error: String(err), isDeleting: false });
      throw err;
    }
  },

  /**
   * Check for updates on all (or specified) central skills.
   * Returns the raw results and updates `updateStatuses` in state.
   */
  checkUpdates: async (skillIds) => {
    set({ isCheckingUpdates: true, error: null });
    try {
      const results = await invoke<SkillUpdateStatus[]>("check_skill_updates", {
        skillIds: skillIds ?? [],
      });
      const map: Record<string, UpdateStatus> = {};
      for (const r of results) {
        map[r.skill_id] = r.update_status;
      }
      set((state) => ({
        updateStatuses: { ...state.updateStatuses, ...map },
        isCheckingUpdates: false,
      }));
      return results;
    } catch (err) {
      set({ error: String(err), isCheckingUpdates: false });
      throw err;
    }
  },

  /**
   * Update a single skill from its GitHub source.
   * Refreshes the skill list after success.
   */
  updateSkill: async (skillId) => {
    set({ updatingSkillId: skillId, error: null });
    try {
      await invoke("update_skill", { skillId });
      const skills = await invoke<SkillWithLinks[]>("get_central_skills");
      // Clear the update status for this skill (it's now up-to-date)
      set((state) => {
        const { [skillId]: _, ...rest } = state.updateStatuses;
        return { skills, updateStatuses: rest, updatingSkillId: null };
      });
    } catch (err) {
      set({ error: String(err), updatingSkillId: null });
      throw err;
    }
  },
}));
