import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CentralSkillsView } from "../pages/CentralSkillsView";
import { AgentWithStatus, SkillWithLinks } from "../types";
import { consumeScrollPosition } from "../lib/scrollRestoration";

// Mock stores
vi.mock("../stores/centralSkillsStore", () => ({
  useCentralSkillsStore: vi.fn(),
}));

vi.mock("../stores/platformStore", () => ({
  usePlatformStore: vi.fn(),
}));

import { useCentralSkillsStore } from "../stores/centralSkillsStore";
import { usePlatformStore } from "../stores/platformStore";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockAgents: AgentWithStatus[] = [
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

const mockSkills: SkillWithLinks[] = [
  {
    id: "frontend-design",
    name: "frontend-design",
    description: "Build distinctive, production-grade frontend interfaces",
    file_path: "~/.agents/skills/frontend-design/SKILL.md",
    canonical_path: "~/.agents/skills/frontend-design",
    is_central: true,
    scanned_at: "2026-04-09T00:00:00Z",
    linked_agents: ["claude-code"],
  },
  {
    id: "code-reviewer",
    name: "code-reviewer",
    description: "Review code changes and identify high-confidence, actionable bugs",
    file_path: "~/.agents/skills/code-reviewer/SKILL.md",
    canonical_path: "~/.agents/skills/code-reviewer",
    is_central: true,
    scanned_at: "2026-04-09T00:00:00Z",
    linked_agents: [],
  },
];

const mockLoadCentralSkills = vi.fn();
const mockInstallSkill = vi.fn();
const mockTogglePlatformLink = vi.fn();
const mockRescan = vi.fn();

function buildCentralStoreState(overrides = {}) {
  return {
    skills: mockSkills,
    agents: mockAgents,
    isLoading: false,
    isInstalling: false,
    togglingAgentId: null,
    error: null,
    loadCentralSkills: mockLoadCentralSkills,
    installSkill: mockInstallSkill,
    togglePlatformLink: mockTogglePlatformLink,
    ...overrides,
  };
}

function buildPlatformStoreState(overrides = {}) {
  return {
    agents: mockAgents,
    skillsByAgent: {},
    isLoading: false,
    isRefreshing: false,
    error: null,
    initialize: vi.fn(),
    rescan: mockRescan,
    refreshCounts: mockRescan,
    ...overrides,
  };
}

function renderCentralSkillsView() {
  vi.mocked(useCentralSkillsStore).mockImplementation((selector?: unknown) => {
    const state = buildCentralStoreState();
    if (typeof selector === "function") return selector(state);
    return state;
  });
  vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
    const state = buildPlatformStoreState();
    if (typeof selector === "function") return selector(state);
    return state;
  });

  return render(
    <MemoryRouter>
      <CentralSkillsView />
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CentralSkillsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consumeScrollPosition("central");
  });

  // ── Header ────────────────────────────────────────────────────────────────

  it("shows page title in header", () => {
    renderCentralSkillsView();
    expect(screen.getByText("中央技能库")).toBeInTheDocument();
  });

  it("shows the central skills directory path", () => {
    renderCentralSkillsView();
    expect(screen.getByText("~/.agents/skills/")).toBeInTheDocument();
  });

  it("shows a refresh button", () => {
    renderCentralSkillsView();
    expect(
      screen.getByRole("button", { name: /刷新中央技能库/i })
    ).toBeInTheDocument();
  });

  it("shows a search input", () => {
    renderCentralSkillsView();
    expect(
      screen.getByPlaceholderText(/搜索中央技能库/i)
    ).toBeInTheDocument();
  });

  // ── Skills List ───────────────────────────────────────────────────────────

  it("renders all central skills", () => {
    renderCentralSkillsView();
    expect(screen.getByText("frontend-design")).toBeInTheDocument();
    expect(screen.getByText("code-reviewer")).toBeInTheDocument();
  });

  it("renders skill descriptions", () => {
    renderCentralSkillsView();
    expect(
      screen.getByText(/Build distinctive, production-grade frontend interfaces/)
    ).toBeInTheDocument();
  });

  it("shows Install to... button for each skill", () => {
    renderCentralSkillsView();
    const installButtons = screen.getAllByRole("button", {
      name: /将 .* 安装到平台/i,
    });
    expect(installButtons).toHaveLength(2);
  });

  it("skill name is a clickable button for detail navigation", () => {
    renderCentralSkillsView();
    // The skill name itself is the detail link (no separate [详情] button).
    const detailBtns = screen.getAllByRole("button", {
      name: /查看 frontend-design 的详情/i,
    });
    expect(detailBtns.length).toBeGreaterThanOrEqual(1);
  });

  // ── Per-platform link status ──────────────────────────────────────────────

  it("shows platform toggle icons for each non-central agent", () => {
    renderCentralSkillsView();
    // Each skill card should have a toggle button for each non-central agent (2 agents x 2 skills = 4)
    const toggleButtons = screen.getAllByRole("button", {
      name: /切换 .* 的链接状态/i,
    });
    expect(toggleButtons.length).toBe(4);
  });

  // ── Empty State ───────────────────────────────────────────────────────────

  it("shows first-visit empty state when no skills exist", () => {
    vi.mocked(useCentralSkillsStore).mockImplementation((selector?: unknown) => {
      const state = buildCentralStoreState({ skills: [] });
      if (typeof selector === "function") return selector(state);
      return state;
    });

    render(
      <MemoryRouter>
        <CentralSkillsView />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/欢迎使用 skills-manage/)
    ).toBeInTheDocument();
    // Should show guidance about creating a skill
    expect(
      screen.getAllByText(/agents\/skills/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows loading state", () => {
    vi.mocked(useCentralSkillsStore).mockImplementation((selector?: unknown) => {
      const state = buildCentralStoreState({ isLoading: true, skills: [] });
      if (typeof selector === "function") return selector(state);
      return state;
    });

    render(
      <MemoryRouter>
        <CentralSkillsView />
      </MemoryRouter>
    );

    expect(screen.getByText("正在加载技能...")).toBeInTheDocument();
  });

  // ── Search / Filter ───────────────────────────────────────────────────────

  it("filters skills by name when searching", async () => {
    renderCentralSkillsView();
    const searchInput = screen.getByPlaceholderText(/搜索中央技能库/i);
    fireEvent.change(searchInput, { target: { value: "frontend" } });

    await waitFor(() => {
      expect(screen.getByText("frontend-design")).toBeInTheDocument();
      expect(screen.queryByText("code-reviewer")).not.toBeInTheDocument();
    });
  });

  it("filters skills by description when searching", async () => {
    renderCentralSkillsView();
    const searchInput = screen.getByPlaceholderText(/搜索中央技能库/i);
    fireEvent.change(searchInput, { target: { value: "actionable" } });

    await waitFor(() => {
      expect(screen.getByText("code-reviewer")).toBeInTheDocument();
      expect(screen.queryByText("frontend-design")).not.toBeInTheDocument();
    });
  });

  it("shows empty state when search has no results", async () => {
    renderCentralSkillsView();
    const searchInput = screen.getByPlaceholderText(/搜索中央技能库/i);
    fireEvent.change(searchInput, { target: { value: "zzz-nonexistent" } });

    await waitFor(() => {
      expect(screen.getByText(/没有匹配的技能/)).toBeInTheDocument();
    });
  });

  it("restores all skills when search is cleared", async () => {
    renderCentralSkillsView();
    const searchInput = screen.getByPlaceholderText(/搜索中央技能库/i);
    fireEvent.change(searchInput, { target: { value: "frontend" } });
    fireEvent.change(searchInput, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.getByText("frontend-design")).toBeInTheDocument();
      expect(screen.getByText("code-reviewer")).toBeInTheDocument();
    });
  });

  // ── Load on Mount ─────────────────────────────────────────────────────────

  it("calls loadCentralSkills on mount", () => {
    renderCentralSkillsView();
    expect(mockLoadCentralSkills).toHaveBeenCalledTimes(1);
  });

  // ── Refresh Button ────────────────────────────────────────────────────────

  it("calls rescan then loadCentralSkills when refresh button is clicked", async () => {
    renderCentralSkillsView();
    const refreshBtn = screen.getByRole("button", {
      name: /刷新中央技能库/i,
    });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      // rescan is called once (only on refresh, not on mount)
      expect(mockRescan).toHaveBeenCalledTimes(1);
      // loadCentralSkills is called twice: once on mount, once on refresh
      expect(mockLoadCentralSkills).toHaveBeenCalledTimes(2);
    });
  });

  // ── Install Dialog ────────────────────────────────────────────────────────

  it("opens install dialog when 'Install to...' is clicked", async () => {
    renderCentralSkillsView();
    const installBtn = screen.getAllByRole("button", {
      name: /将 .* 安装到平台/i,
    })[0];
    fireEvent.click(installBtn);

    // Dialog should open (skill name should appear in dialog title)
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("passes central scroll restoration state when opening detail", async () => {
    render(
      <MemoryRouter initialEntries={["/central"]}>
        <Routes>
          <Route path="/central" element={<CentralSkillsView />} />
          <Route path="/skill/:skillId" element={<div>detail-route</div>} />
        </Routes>
      </MemoryRouter>
    );

    const scroller = screen.getByText("frontend-design").closest("[class*='overflow-auto']");
    expect(scroller).not.toBeNull();
    if (!scroller) return;

    Object.defineProperty(scroller, "scrollTop", {
      value: 240,
      writable: true,
      configurable: true,
    });

    fireEvent.click(screen.getByRole("button", { name: /查看 frontend-design 的详情/i }));

    await waitFor(() => {
      expect(screen.getByText("detail-route")).toBeInTheDocument();
    });

    const historyState = window.history.state?.usr;
    expect(historyState.scrollRestoration).toEqual({
      key: "central",
      scrollTop: 240,
    });
  });

  it("restores nested scroll position after data has hydrated", async () => {
    let centralState = buildCentralStoreState({
      skills: [],
      isLoading: true,
    });

    vi.mocked(useCentralSkillsStore).mockImplementation((selector?: unknown) => {
      if (typeof selector === "function") return selector(centralState);
      return centralState;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });

    const { rerender } = render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/central",
            state: {
              scrollRestoration: {
                key: "central",
                scrollTop: 360,
              },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/central" element={<CentralSkillsView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("正在加载技能...")).toBeInTheDocument();
    expect(consumeScrollPosition("central")).toBeNull();

    centralState = buildCentralStoreState();
    rerender(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/central",
            state: {
              scrollRestoration: {
                key: "central",
                scrollTop: 360,
              },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/central" element={<CentralSkillsView />} />
        </Routes>
      </MemoryRouter>
    );

    const scroller = screen.getByText("frontend-design").closest("[class*='overflow-auto']");
    expect(scroller).not.toBeNull();
    if (!scroller) return;

    await waitFor(() => {
      expect((scroller as HTMLDivElement).scrollTop).toBe(360);
    });
  });
});
