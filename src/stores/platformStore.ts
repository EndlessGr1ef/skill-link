import { create } from "zustand";
import { invoke, isTauriRuntime } from "@/lib/tauri";
import { AgentWithStatus, ScanResult, SkillInstallation } from "@/types";

const BROWSER_FIXTURE_AGENTS: AgentWithStatus[] = [
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

const BROWSER_FIXTURE_COUNTS: ScanResult = {
  total_skills: 1,
  agents_scanned: 3,
  skills_by_agent: {
    "claude-code": 1,
    cursor: 1,
    central: 1,
  },
};

// ─── State ────────────────────────────────────────────────────────────────────

interface PlatformState {
  agents: AgentWithStatus[];
  skillsByAgent: Record<string, number>;
  /** Project-level installations keyed by agent_id */
  projectInstallations: Record<string, SkillInstallation[]>;
  isLoading: boolean;
  isRefreshing: boolean;
  scanGeneration?: number;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  rescan: () => Promise<void>;
  refreshCounts: () => Promise<void>;
  loadProjectInstallations: (agentId: string) => Promise<void>;
  installSkillToProject: (skillId: string, agentId: string, projectPath: string) => Promise<void>;
  uninstallSkillFromProject: (skillId: string, agentId: string, projectPath: string) => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlatformStore = create<PlatformState>((set, get) => ({
  agents: [],
  skillsByAgent: {},
  projectInstallations: {},
  isLoading: false,
  isRefreshing: false,
  scanGeneration: 0,
  error: null,

  /**
   * Initialize the store on app mount: load agents then trigger a full scan.
   * Called once from AppShell's useEffect.
   */
  initialize: async () => {
    set({ isLoading: true, error: null });
    if (!isTauriRuntime()) {
      set((state) => ({
        agents: BROWSER_FIXTURE_AGENTS,
        skillsByAgent: BROWSER_FIXTURE_COUNTS.skills_by_agent,
        isLoading: false,
        scanGeneration: (state.scanGeneration ?? 0) + 1,
      }));
      return;
    }
    try {
      const [agents, scanResult] = await Promise.all([
        invoke<AgentWithStatus[]>("get_agents"),
        invoke<ScanResult>("scan_all_skills"),
      ]);
      set((state) => ({
        agents,
        skillsByAgent: scanResult.skills_by_agent,
        isLoading: false,
        scanGeneration: (state.scanGeneration ?? 0) + 1,
      }));
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  /**
   * Re-trigger a full scan and refresh agent list.
   * Called from manual refresh button.
   */
  rescan: async () => {
    set({ isLoading: true, error: null });
    if (!isTauriRuntime()) {
      set((state) => ({
        agents: BROWSER_FIXTURE_AGENTS,
        skillsByAgent: BROWSER_FIXTURE_COUNTS.skills_by_agent,
        isLoading: false,
        scanGeneration: (state.scanGeneration ?? 0) + 1,
      }));
      return;
    }
    try {
      const [agents, scanResult] = await Promise.all([
        invoke<AgentWithStatus[]>("get_agents"),
        invoke<ScanResult>("scan_all_skills"),
      ]);
      set((state) => ({
        agents,
        skillsByAgent: scanResult.skills_by_agent,
        isLoading: false,
        scanGeneration: (state.scanGeneration ?? 0) + 1,
      }));
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  refreshCounts: async () => {
    set({ isRefreshing: true, error: null });
    if (!isTauriRuntime()) {
      set((state) => ({
        agents: BROWSER_FIXTURE_AGENTS,
        skillsByAgent: BROWSER_FIXTURE_COUNTS.skills_by_agent,
        isRefreshing: false,
        isLoading: state.isLoading,
        scanGeneration: (state.scanGeneration ?? 0) + 1,
      }));
      return;
    }
    try {
      const [agents, scanResult] = await Promise.all([
        invoke<AgentWithStatus[]>("get_agents"),
        invoke<ScanResult>("scan_all_skills"),
      ]);
      set((state) => ({
        agents,
        skillsByAgent: scanResult.skills_by_agent,
        isRefreshing: false,
        isLoading: state.isLoading,
        scanGeneration: (state.scanGeneration ?? 0) + 1,
      }));
    } catch (err) {
      set({ error: String(err), isRefreshing: false });
    }
  },

  loadProjectInstallations: async (agentId: string) => {
    if (!isTauriRuntime()) return;
    try {
      const installations = await invoke<SkillInstallation[]>(
        "get_project_skill_installations",
        { agentId },
      );
      set((state) => ({
        projectInstallations: {
          ...state.projectInstallations,
          [agentId]: installations,
        },
      }));
    } catch (err) {
      console.error("Failed to load project installations:", err);
    }
  },

  installSkillToProject: async (skillId: string, agentId: string, projectPath: string) => {
    if (!isTauriRuntime()) return;
    await invoke("install_skill_to_project", { skillId, agentId, projectPath });
    // Refresh project installations and skill counts
    await Promise.all([
      get().loadProjectInstallations(agentId),
      get().refreshCounts(),
    ]);
  },

  uninstallSkillFromProject: async (skillId: string, agentId: string, projectPath: string) => {
    if (!isTauriRuntime()) return;
    await invoke("uninstall_skill_from_project", { skillId, agentId, projectPath });
    // Refresh project installations and skill counts
    await Promise.all([
      get().loadProjectInstallations(agentId),
      get().refreshCounts(),
    ]);
  },
}));
