import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillDetail } from "../types";

// Mock Tauri core before importing the store
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { useSkillDetailStore } from "../stores/skillDetailStore";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockDetail: SkillDetail = {
  id: "frontend-design",
  name: "frontend-design",
  description: "Build distinctive, production-grade frontend interfaces",
  file_path: "~/.agents/skills/frontend-design/SKILL.md",
  canonical_path: "~/.agents/skills/frontend-design",
  is_central: true,
  source: "native",
  scanned_at: "2026-04-09T00:00:00Z",
  installations: [
    {
      skill_id: "frontend-design",
      agent_id: "claude-code",
      installed_path: "~/.claude/skills/frontend-design",
      link_type: "symlink",
      symlink_target: "~/.agents/skills/frontend-design",
    },
  ],
};

const mockContent = "---\nname: frontend-design\n---\n\n# Frontend Design\n\nContent here.";

const mockDetailAfterInstall: SkillDetail = {
  ...mockDetail,
  installations: [
    ...mockDetail.installations,
    {
      skill_id: "frontend-design",
      agent_id: "cursor",
      installed_path: "~/.cursor/skills/frontend-design",
      link_type: "symlink",
      symlink_target: "~/.agents/skills/frontend-design",
    },
  ],
};

const mockDetailAfterUninstall: SkillDetail = {
  ...mockDetail,
  installations: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("skillDetailStore", () => {
  beforeEach(() => {
    useSkillDetailStore.setState({
      detail: null,
      content: null,
      isLoading: false,
      installingAgentId: null,
      error: null,
    });
    vi.clearAllMocks();
  });

  // ── Initial State ─────────────────────────────────────────────────────────

  it("has correct initial state", () => {
    const state = useSkillDetailStore.getState();
    expect(state.detail).toBeNull();
    expect(state.content).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.installingAgentId).toBeNull();
    expect(state.error).toBeNull();
  });

  // ── loadDetail ────────────────────────────────────────────────────────────

  it("calls get_skill_detail with skillId", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockContent);
    await useSkillDetailStore.getState().loadDetail("frontend-design");
    expect(invoke).toHaveBeenCalledWith("get_skill_detail", {
      skillId: "frontend-design",
    });
  });

  it("calls read_skill_content with skillId", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockContent);
    await useSkillDetailStore.getState().loadDetail("frontend-design");
    expect(invoke).toHaveBeenCalledWith("read_skill_content", {
      skillId: "frontend-design",
    });
  });

  it("stores detail and content after successful load", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockContent);
    await useSkillDetailStore.getState().loadDetail("frontend-design");
    const state = useSkillDetailStore.getState();
    expect(state.detail).toEqual(mockDetail);
    expect(state.content).toBe(mockContent);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("sets loading to true while fetching", async () => {
    let resolveDetail!: (v: SkillDetail) => void;
    vi.mocked(invoke)
      .mockReturnValueOnce(new Promise<SkillDetail>((r) => (resolveDetail = r)))
      .mockResolvedValueOnce(mockContent);

    const fetchPromise = useSkillDetailStore.getState().loadDetail("frontend-design");
    expect(useSkillDetailStore.getState().isLoading).toBe(true);

    resolveDetail(mockDetail);
    await fetchPromise;

    expect(useSkillDetailStore.getState().isLoading).toBe(false);
  });

  it("sets error and clears loading when load fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Skill not found"));
    await useSkillDetailStore.getState().loadDetail("nonexistent");
    const state = useSkillDetailStore.getState();
    expect(state.error).toContain("Skill not found");
    expect(state.isLoading).toBe(false);
  });

  // ── installSkill ──────────────────────────────────────────────────────────

  it("calls install_skill_to_agent with skillId, agentId and method=symlink", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined) // install_skill_to_agent
      .mockResolvedValueOnce(mockDetailAfterInstall); // get_skill_detail refresh
    await useSkillDetailStore.getState().installSkill("frontend-design", "cursor");
    expect(invoke).toHaveBeenCalledWith("install_skill_to_agent", {
      skillId: "frontend-design",
      agentId: "cursor",
      method: "symlink",
    });
  });

  it("reloads detail after install", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(mockDetailAfterInstall);
    await useSkillDetailStore.getState().installSkill("frontend-design", "cursor");
    const state = useSkillDetailStore.getState();
    expect(state.detail?.installations).toHaveLength(2);
    expect(state.installingAgentId).toBeNull();
  });

  it("sets installingAgentId during install", async () => {
    let resolveInstall!: (v: undefined) => void;
    vi.mocked(invoke)
      .mockReturnValueOnce(new Promise<undefined>((r) => (resolveInstall = r)))
      .mockResolvedValueOnce(mockDetailAfterInstall);

    const installPromise = useSkillDetailStore
      .getState()
      .installSkill("frontend-design", "cursor");
    expect(useSkillDetailStore.getState().installingAgentId).toBe("cursor");

    resolveInstall(undefined);
    await installPromise;

    expect(useSkillDetailStore.getState().installingAgentId).toBeNull();
  });

  it("sets error when install fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Permission denied"));
    await useSkillDetailStore.getState().installSkill("frontend-design", "cursor");
    const state = useSkillDetailStore.getState();
    expect(state.error).toContain("Permission denied");
    expect(state.installingAgentId).toBeNull();
  });

  // ── uninstallSkill ────────────────────────────────────────────────────────

  it("calls uninstall_skill_from_agent with skillId and agentId", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(mockDetailAfterUninstall);
    await useSkillDetailStore.getState().uninstallSkill("frontend-design", "claude-code");
    expect(invoke).toHaveBeenCalledWith("uninstall_skill_from_agent", {
      skillId: "frontend-design",
      agentId: "claude-code",
    });
  });

  it("reloads detail after uninstall", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(mockDetailAfterUninstall);
    await useSkillDetailStore.getState().uninstallSkill("frontend-design", "claude-code");
    const state = useSkillDetailStore.getState();
    expect(state.detail?.installations).toHaveLength(0);
    expect(state.installingAgentId).toBeNull();
  });

  it("sets error when uninstall fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Not installed"));
    await useSkillDetailStore.getState().uninstallSkill("frontend-design", "claude-code");
    const state = useSkillDetailStore.getState();
    expect(state.error).toContain("Not installed");
    expect(state.installingAgentId).toBeNull();
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  it("resets store to initial state", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockContent);
    await useSkillDetailStore.getState().loadDetail("frontend-design");
    // Now reset
    useSkillDetailStore.getState().reset();
    const state = useSkillDetailStore.getState();
    expect(state.detail).toBeNull();
    expect(state.content).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});
