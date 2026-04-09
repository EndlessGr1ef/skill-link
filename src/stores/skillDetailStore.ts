import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { SkillDetail } from "@/types";

// ─── State ────────────────────────────────────────────────────────────────────

interface SkillDetailState {
  detail: SkillDetail | null;
  content: string | null;
  isLoading: boolean;
  /** Agent ID currently being installed/uninstalled (null = idle). */
  installingAgentId: string | null;
  error: string | null;

  // Actions
  loadDetail: (skillId: string) => Promise<void>;
  installSkill: (skillId: string, agentId: string) => Promise<void>;
  uninstallSkill: (skillId: string, agentId: string) => Promise<void>;
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSkillDetailStore = create<SkillDetailState>((set) => ({
  detail: null,
  content: null,
  isLoading: false,
  installingAgentId: null,
  error: null,

  /**
   * Load skill detail metadata and raw SKILL.md content in parallel.
   * Calls get_skill_detail and read_skill_content Tauri commands.
   */
  loadDetail: async (skillId: string) => {
    set({ isLoading: true, error: null });
    try {
      const [detail, content] = await Promise.all([
        invoke<SkillDetail>("get_skill_detail", { skillId }),
        invoke<string>("read_skill_content", { skillId }),
      ]);
      set({ detail, content, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  /**
   * Install the skill to the given agent via symlink.
   * Reloads detail afterward so installation status updates.
   */
  installSkill: async (skillId: string, agentId: string) => {
    set({ installingAgentId: agentId, error: null });
    try {
      await invoke("install_skill_to_agent", {
        skillId,
        agentId,
        method: "symlink",
      });
      // Reload detail so the installations list reflects the new install.
      const detail = await invoke<SkillDetail>("get_skill_detail", { skillId });
      set({ detail, installingAgentId: null });
    } catch (err) {
      set({ error: String(err), installingAgentId: null });
    }
  },

  /**
   * Remove the skill installation from the given agent.
   * Reloads detail afterward so installation status updates.
   */
  uninstallSkill: async (skillId: string, agentId: string) => {
    set({ installingAgentId: agentId, error: null });
    try {
      await invoke("uninstall_skill_from_agent", { skillId, agentId });
      // Reload detail so the installations list reflects the removal.
      const detail = await invoke<SkillDetail>("get_skill_detail", { skillId });
      set({ detail, installingAgentId: null });
    } catch (err) {
      set({ error: String(err), installingAgentId: null });
    }
  },

  /**
   * Reset the store to its initial state (called when leaving the detail page).
   */
  reset: () => {
    set({
      detail: null,
      content: null,
      isLoading: false,
      installingAgentId: null,
      error: null,
    });
  },
}));
