import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { AgentWithStatus, ScanResult } from "@/types";

// ─── State ────────────────────────────────────────────────────────────────────

interface PlatformState {
  agents: AgentWithStatus[];
  skillsByAgent: Record<string, number>;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  rescan: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlatformStore = create<PlatformState>((set) => ({
  agents: [],
  skillsByAgent: {},
  isLoading: false,
  isRefreshing: false,
  error: null,

  /**
   * Initialize the store on app mount: load agents then trigger a full scan.
   * Called once from AppShell's useEffect.
   */
  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const [agents, scanResult] = await Promise.all([
        invoke<AgentWithStatus[]>("get_agents"),
        invoke<ScanResult>("scan_all_skills"),
      ]);
      set({
        agents,
        skillsByAgent: scanResult.skills_by_agent,
        isLoading: false,
      });
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
    try {
      const [agents, scanResult] = await Promise.all([
        invoke<AgentWithStatus[]>("get_agents"),
        invoke<ScanResult>("scan_all_skills"),
      ]);
      set({
        agents,
        skillsByAgent: scanResult.skills_by_agent,
        isLoading: false,
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  refreshCounts: async () => {
    set({ isRefreshing: true, error: null });
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
      }));
    } catch (err) {
      set({ error: String(err), isRefreshing: false });
    }
  },
}));
