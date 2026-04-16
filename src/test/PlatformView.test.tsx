import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlatformView } from "../pages/PlatformView";
import { AgentWithStatus, ScannedSkill } from "../types";
import { consumeScrollPosition } from "../lib/scrollRestoration";

// Mock stores
vi.mock("../stores/platformStore", () => ({
  usePlatformStore: vi.fn(),
}));

vi.mock("../stores/skillStore", () => ({
  useSkillStore: vi.fn(),
}));

vi.mock("../stores/centralSkillsStore", () => ({
  useCentralSkillsStore: vi.fn(),
}));

import { usePlatformStore } from "../stores/platformStore";
import { useSkillStore } from "../stores/skillStore";
import { useCentralSkillsStore } from "../stores/centralSkillsStore";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockAgent: AgentWithStatus = {
  id: "claude-code",
  display_name: "Claude Code",
  category: "coding",
  global_skills_dir: "~/.claude/skills/",
  is_detected: true,
  is_builtin: true,
  is_enabled: true,
};

const mockSkills: ScannedSkill[] = [
  {
    id: "frontend-design",
    name: "frontend-design",
    description: "Build distinctive, production-grade frontend interfaces",
    file_path: "~/.claude/skills/frontend-design/SKILL.md",
    dir_path: "~/.claude/skills/frontend-design",
    link_type: "symlink",
    symlink_target: "~/.agents/skills/frontend-design",
    is_central: true,
  },
  {
    id: "code-reviewer",
    name: "code-reviewer",
    description: "Review code changes and identify high-confidence actionable bugs",
    file_path: "~/.claude/skills/code-reviewer/SKILL.md",
    dir_path: "~/.claude/skills/code-reviewer",
    link_type: "copy",
    is_central: false,
  },
];

const mockGetSkillsByAgent = vi.fn();
const mockLoadCentralSkills = vi.fn();
const mockInstallSkill = vi.fn();

function buildPlatformStoreState(overrides = {}) {
  return {
    agents: [mockAgent],
    skillsByAgent: { "claude-code": 2 },
    isLoading: false,
    isRefreshing: false,
    error: null,
    initialize: vi.fn(),
    rescan: vi.fn(),
    refreshCounts: vi.fn(),
    ...overrides,
  };
}

function buildSkillStoreState(overrides = {}) {
  return {
    skillsByAgent: { "claude-code": mockSkills },
    loadingByAgent: { "claude-code": false },
    error: null,
    getSkillsByAgent: mockGetSkillsByAgent,
    ...overrides,
  };
}

function renderPlatformView(agentId = "claude-code") {
  vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
    const state = buildPlatformStoreState();
    if (typeof selector === "function") return selector(state);
    return state;
  });
  vi.mocked(useSkillStore).mockImplementation((selector?: unknown) => {
    const state = buildSkillStoreState();
    if (typeof selector === "function") return selector(state);
    return state;
  });
  vi.mocked(useCentralSkillsStore).mockImplementation((selector?: unknown) => {
    const state = {
      skills: [],
      agents: [mockAgent],
      loadCentralSkills: mockLoadCentralSkills,
      installSkill: mockInstallSkill,
    };
    if (typeof selector === "function") return selector(state);
    return state;
  });

  return render(
    <MemoryRouter initialEntries={[`/platform/${agentId}`]}>
      <Routes>
        <Route path="/platform/:agentId" element={<PlatformView />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PlatformView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consumeScrollPosition("platform:claude-code");
  });

  // ── Header ────────────────────────────────────────────────────────────────

  it("shows platform name in header", () => {
    renderPlatformView();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
  });

  it("shows platform directory path in header", () => {
    renderPlatformView();
    expect(screen.getByText("~/.claude/skills/")).toBeInTheDocument();
  });

  // ── Skill List ────────────────────────────────────────────────────────────

  it("renders skill cards for all skills", () => {
    renderPlatformView();
    expect(screen.getByText("frontend-design")).toBeInTheDocument();
    expect(screen.getByText("code-reviewer")).toBeInTheDocument();
  });

  it("shows source indicator on skill cards", () => {
    renderPlatformView();
    expect(screen.getByText("中央技能库 · 符号链接")).toBeInTheDocument();
    expect(screen.getByText("独立安装 · 复制安装")).toBeInTheDocument();
  });

  // ── Empty State ───────────────────────────────────────────────────────────

  it("shows empty state when platform has no skills", () => {
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState({
        skillsByAgent: { "claude-code": 0 },
      });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(useSkillStore).mockImplementation((selector?: unknown) => {
      const state = buildSkillStoreState({
        skillsByAgent: { "claude-code": [] },
      });
      if (typeof selector === "function") return selector(state);
      return state;
    });

    render(
      <MemoryRouter initialEntries={["/platform/claude-code"]}>
        <Routes>
          <Route path="/platform/:agentId" element={<PlatformView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText(/该平台暂无技能/)
    ).toBeInTheDocument();
  });

  // ── Platform Not Found ────────────────────────────────────────────────────

  it("shows not found when agent doesn't exist", () => {
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState({ agents: [] });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(useSkillStore).mockImplementation((selector?: unknown) => {
      const state = buildSkillStoreState({ skillsByAgent: {} });
      if (typeof selector === "function") return selector(state);
      return state;
    });

    render(
      <MemoryRouter initialEntries={["/platform/unknown"]}>
        <Routes>
          <Route path="/platform/:agentId" element={<PlatformView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("未找到平台")).toBeInTheDocument();
  });

  // ── Search / Filter ───────────────────────────────────────────────────────

  it("renders search input", () => {
    renderPlatformView();
    expect(
      screen.getByPlaceholderText(/搜索技能/)
    ).toBeInTheDocument();
  });

  it("filters skills by name when searching", async () => {
    renderPlatformView();
    const searchInput = screen.getByPlaceholderText(/搜索技能/);
    fireEvent.change(searchInput, { target: { value: "frontend" } });

    await waitFor(() => {
      expect(screen.getByText("frontend-design")).toBeInTheDocument();
      expect(screen.queryByText("code-reviewer")).not.toBeInTheDocument();
    });
  });

  it("filters skills by description when searching", async () => {
    renderPlatformView();
    const searchInput = screen.getByPlaceholderText(/搜索技能/);
    fireEvent.change(searchInput, { target: { value: "actionable" } });

    await waitFor(() => {
      expect(screen.getByText("code-reviewer")).toBeInTheDocument();
      expect(screen.queryByText("frontend-design")).not.toBeInTheDocument();
    });
  });

  it("shows all skills when search is cleared", async () => {
    renderPlatformView();
    const searchInput = screen.getByPlaceholderText(/搜索技能/);
    fireEvent.change(searchInput, { target: { value: "frontend" } });
    fireEvent.change(searchInput, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.getByText("frontend-design")).toBeInTheDocument();
      expect(screen.getByText("code-reviewer")).toBeInTheDocument();
    });
  });

  it("shows empty state message when search has no results", async () => {
    renderPlatformView();
    const searchInput = screen.getByPlaceholderText(/搜索技能/);
    fireEvent.change(searchInput, { target: { value: "nonexistent-skill-xyz" } });

    await waitFor(() => {
      expect(screen.getByText(/没有匹配的技能/)).toBeInTheDocument();
    });
  });

  // ── Data Loading ──────────────────────────────────────────────────────────

  it("calls getSkillsByAgent on mount", () => {
    renderPlatformView();
    expect(mockGetSkillsByAgent).toHaveBeenCalledWith("claude-code");
  });

  it("passes platform-specific scroll restoration state when opening detail", async () => {
    render(
      <MemoryRouter initialEntries={["/platform/claude-code"]}>
        <Routes>
          <Route path="/platform/:agentId" element={<PlatformView />} />
          <Route path="/skill/:skillId" element={<div>detail-route</div>} />
        </Routes>
      </MemoryRouter>
    );

    const scroller = screen.getByText("frontend-design").closest("[class*='overflow-auto']");
    expect(scroller).not.toBeNull();
    if (!scroller) return;

    Object.defineProperty(scroller, "scrollTop", {
      value: 180,
      writable: true,
      configurable: true,
    });

    fireEvent.click(screen.getByRole("button", { name: /查看 frontend-design 的详情/i }));

    await waitFor(() => {
      expect(screen.getByText("detail-route")).toBeInTheDocument();
    });

    const historyState = window.history.state?.usr;
    expect(historyState.scrollRestoration).toEqual({
      key: "platform:claude-code",
      scrollTop: 180,
    });
  });

  it("restores platform scroll after async hydration completes", async () => {
    let skillState = buildSkillStoreState({
      skillsByAgent: { "claude-code": [] },
      loadingByAgent: { "claude-code": true },
    });

    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(useSkillStore).mockImplementation((selector?: unknown) => {
      if (typeof selector === "function") return selector(skillState);
      return skillState;
    });
    vi.mocked(useCentralSkillsStore).mockImplementation((selector?: unknown) => {
      const state = {
        skills: [],
        agents: [mockAgent],
        loadCentralSkills: mockLoadCentralSkills,
        installSkill: mockInstallSkill,
      };
      if (typeof selector === "function") return selector(state);
      return state;
    });

    const { rerender } = render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/platform/claude-code",
            state: {
              scrollRestoration: {
                key: "platform:claude-code",
                scrollTop: 420,
              },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/platform/:agentId" element={<PlatformView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("正在加载技能...")).toBeInTheDocument();
    expect(consumeScrollPosition("platform:claude-code")).toBeNull();

    skillState = buildSkillStoreState();
    rerender(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/platform/claude-code",
            state: {
              scrollRestoration: {
                key: "platform:claude-code",
                scrollTop: 420,
              },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/platform/:agentId" element={<PlatformView />} />
        </Routes>
      </MemoryRouter>
    );

    const scroller = screen.getByText("frontend-design").closest("[class*='overflow-auto']");
    expect(scroller).not.toBeNull();
    if (!scroller) return;

    await waitFor(() => {
      expect((scroller as HTMLDivElement).scrollTop).toBe(420);
    });
  });
});
