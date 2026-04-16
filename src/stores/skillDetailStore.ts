import { create } from "zustand";
import { invoke, isTauriRuntime, listen } from "@/lib/tauri";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { SkillDetail } from "@/types";

interface ExplanationChunkPayload {
  skill_id?: string;
  skillId?: string;
  chunk?: string;
  text?: string;
}

interface ExplanationCompletePayload {
  skill_id?: string;
  skillId?: string;
  explanation?: string;
  error?: string;
}

interface ExplanationErrorPayload {
  skill_id?: string;
  skillId?: string;
  error?: string;
  error_info?: ExplanationErrorInfo;
}

export interface ExplanationErrorInfo {
  message: string;
  details: string;
  kind: "proxy" | "connect" | "timeout" | "dns" | "tls" | "auth" | "response" | "unknown";
  retryable: boolean;
  fallbackTried: boolean;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface SkillDetailState {
  detail: SkillDetail | null;
  content: string | null;
  isLoading: boolean;
  /** Agent ID currently being installed/uninstalled (null = idle). */
  installingAgentId: string | null;
  error: string | null;
  explanation: string | null;
  isExplanationLoading: boolean;
  isExplanationStreaming: boolean;
  explanationError: string | null;
  explanationErrorInfo: ExplanationErrorInfo | null;

  // Actions
  loadDetail: (skillId: string) => Promise<void>;
  loadCachedExplanation: (skillId: string, lang: string) => Promise<void>;
  generateExplanation: (skillId: string, content: string, lang: string) => Promise<void>;
  refreshExplanation: (skillId: string, content: string, lang: string) => Promise<void>;
  installSkill: (skillId: string, agentId: string) => Promise<void>;
  uninstallSkill: (skillId: string, agentId: string) => Promise<void>;
  refreshInstallations: (skillId: string) => Promise<void>;
  cleanupExplanationListeners: () => void;
  reset: () => void;
}

// ─── Event listeners (managed outside store) ──────────────────────────────────

let unlistenChunk: UnlistenFn | null = null;
let unlistenComplete: UnlistenFn | null = null;
let unlistenError: UnlistenFn | null = null;
let activeExplanationSkillId: string | null = null;
let activeExplanationRequestId = 0;

function nextExplanationRequestId() {
  activeExplanationRequestId += 1;
  return activeExplanationRequestId;
}

function payloadSkillId(payload: ExplanationChunkPayload | ExplanationCompletePayload) {
  return payload.skill_id ?? payload.skillId ?? null;
}

function payloadChunkText(payload: ExplanationChunkPayload) {
  return payload.chunk ?? payload.text ?? "";
}

function cleanupExplanationListeners() {
  if (unlistenChunk) { unlistenChunk(); unlistenChunk = null; }
  if (unlistenComplete) { unlistenComplete(); unlistenComplete = null; }
  if (unlistenError) { unlistenError(); unlistenError = null; }
  activeExplanationSkillId = null;
}

function startExplanationRequest(set: (fn: Partial<SkillDetailState>) => void) {
  cleanupExplanationListeners();
  set({
    explanation: null,
    isExplanationLoading: true,
    isExplanationStreaming: false,
    explanationError: null,
    explanationErrorInfo: null,
  });
  return nextExplanationRequestId();
}

function failExplanationRequest(
  requestId: number,
  error: unknown,
  set: (fn: Partial<SkillDetailState>) => void
) {
  if (requestId !== activeExplanationRequestId) {
    return;
  }
  cleanupExplanationListeners();
  set({
    explanation: null,
    explanationError: String(error),
    explanationErrorInfo: null,
    isExplanationLoading: false,
    isExplanationStreaming: false,
  });
}

async function setupExplanationListeners(
  skillId: string,
  requestId: number,
  set: (fn: Partial<SkillDetailState> | ((s: SkillDetailState) => Partial<SkillDetailState>)) => void
) {
  cleanupExplanationListeners();
  activeExplanationSkillId = skillId;
  activeExplanationRequestId = requestId;

  unlistenChunk = await listen<ExplanationChunkPayload>("skill:explanation:chunk", (event) => {
    const eventSkillId = payloadSkillId(event.payload);
    if (requestId !== activeExplanationRequestId) return;
    if (eventSkillId && eventSkillId !== activeExplanationSkillId) return;
    const chunkText = payloadChunkText(event.payload);
    if (!chunkText) return;
    set((state) => ({
      explanation: `${state.explanation ?? ""}${chunkText}`,
      isExplanationLoading: false,
      isExplanationStreaming: true,
    }));
  });

  unlistenComplete = await listen<ExplanationCompletePayload>("skill:explanation:complete", (event) => {
    const eventSkillId = payloadSkillId(event.payload);
    if (requestId !== activeExplanationRequestId) return;
    if (eventSkillId && eventSkillId !== activeExplanationSkillId) return;
    set((state) => ({
      explanation: event.payload.explanation ?? state.explanation,
      explanationError: event.payload.error ?? null,
      explanationErrorInfo: null,
      isExplanationLoading: false,
      isExplanationStreaming: false,
    }));
    cleanupExplanationListeners();
  });

  unlistenError = await listen<ExplanationErrorPayload>("skill:explanation:error", (event) => {
    const eventSkillId = payloadSkillId(event.payload);
    if (requestId !== activeExplanationRequestId) return;
    if (eventSkillId && eventSkillId !== activeExplanationSkillId) return;
    set({
      explanation: null,
      explanationError: event.payload.error ?? "Unknown explanation error",
      explanationErrorInfo: event.payload.error_info ?? null,
      isExplanationLoading: false,
      isExplanationStreaming: false,
    });
    cleanupExplanationListeners();
  });
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSkillDetailStore = create<SkillDetailState>((set) => ({
  detail: null,
  content: null,
  isLoading: false,
  installingAgentId: null,
  error: null,
  explanation: null,
  isExplanationLoading: false,
  isExplanationStreaming: false,
  explanationError: null,
  explanationErrorInfo: null,

  /**
   * Load skill detail metadata and raw SKILL.md content in parallel.
   * Calls get_skill_detail and read_skill_content Tauri commands.
   */
  loadDetail: async (skillId: string) => {
    set({ isLoading: true, error: null });
    if (!isTauriRuntime()) {
      set({
        detail: null,
        content: null,
        isLoading: false,
        error: null,
      });
      return;
    }
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

  loadCachedExplanation: async (skillId: string, lang: string) => {
    const requestId = startExplanationRequest(set);
    if (!isTauriRuntime()) {
      set({
        explanation: null,
        isExplanationLoading: false,
        isExplanationStreaming: false,
        explanationError: null,
        explanationErrorInfo: null,
      });
      return;
    }
    try {
      const explanation = await invoke<string | null>("get_skill_explanation", { skillId, lang });
      if (requestId !== activeExplanationRequestId) return;
      set({
        explanation,
        isExplanationLoading: false,
        isExplanationStreaming: false,
        explanationError: null,
        explanationErrorInfo: null,
      });
    } catch (err) {
      failExplanationRequest(requestId, err, set);
    }
  },

  generateExplanation: async (skillId: string, content: string, lang: string) => {
    const requestId = startExplanationRequest(set);
    if (!isTauriRuntime()) {
      set({
        explanation: null,
        isExplanationLoading: false,
        isExplanationStreaming: false,
        explanationError: "AI explanation requires the Tauri desktop runtime.",
        explanationErrorInfo: null,
      });
      return;
    }
    try {
      await setupExplanationListeners(skillId, requestId, set);
      await invoke("explain_skill_stream", { skillId, content, lang });
    } catch (err) {
      failExplanationRequest(requestId, err, set);
    }
  },

  refreshExplanation: async (skillId: string, content: string, lang: string) => {
    const requestId = startExplanationRequest(set);
    if (!isTauriRuntime()) {
      set({
        explanation: null,
        isExplanationLoading: false,
        isExplanationStreaming: false,
        explanationError: "AI explanation requires the Tauri desktop runtime.",
        explanationErrorInfo: null,
      });
      return;
    }
    try {
      await setupExplanationListeners(skillId, requestId, set);
      await invoke("refresh_skill_explanation", { skillId, content, lang });
    } catch (err) {
      failExplanationRequest(requestId, err, set);
    }
  },

  /**
   * Install the skill to the given agent via symlink.
   * Reloads detail afterward so installation status updates.
   */
  installSkill: async (skillId: string, agentId: string) => {
    set({ installingAgentId: agentId, error: null });
    if (!isTauriRuntime()) {
      set({
        installingAgentId: null,
        error: "Installing skills requires the Tauri desktop runtime.",
      });
      return;
    }
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
    if (!isTauriRuntime()) {
      set({
        installingAgentId: null,
        error: "Uninstalling skills requires the Tauri desktop runtime.",
      });
      return;
    }
    try {
      await invoke("uninstall_skill_from_agent", { skillId, agentId });
      // Reload detail so the installations list reflects the removal.
      const detail = await invoke<SkillDetail>("get_skill_detail", { skillId });
      set({ detail, installingAgentId: null });
    } catch (err) {
      set({ error: String(err), installingAgentId: null });
    }
  },

  refreshInstallations: async (skillId: string) => {
    if (!isTauriRuntime()) {
      return;
    }
    try {
      const detail = await invoke<SkillDetail>("get_skill_detail", { skillId });
      set((state) => ({
        detail,
        content: state.content,
        isLoading: state.isLoading,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  cleanupExplanationListeners,

  /**
   * Reset the store to its initial state (called when leaving the detail page).
   */
  reset: () => {
    cleanupExplanationListeners();
    set({
      detail: null,
      content: null,
      isLoading: false,
      installingAgentId: null,
      error: null,
      explanation: null,
      isExplanationLoading: false,
      isExplanationStreaming: false,
      explanationError: null,
      explanationErrorInfo: null,
    });
  },
}));
