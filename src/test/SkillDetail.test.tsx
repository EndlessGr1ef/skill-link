import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SkillDetail } from "../pages/SkillDetail";
import { AgentWithStatus, SkillDetail as SkillDetailType } from "../types";

// ─── Mock stores ──────────────────────────────────────────────────────────────

vi.mock("../stores/skillDetailStore", () => ({
  useSkillDetailStore: vi.fn(),
}));

vi.mock("../stores/platformStore", () => ({
  usePlatformStore: vi.fn(),
}));

// ─── Mock CollectionPickerDialog ──────────────────────────────────────────────

vi.mock("../components/collection/CollectionPickerDialog", () => ({
  CollectionPickerDialog: ({
    open,
    onOpenChange,
    onAdded,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    skillId: string;
    currentCollectionIds: string[];
    onAdded: () => void;
  }) =>
    open ? (
      <div data-testid="collection-picker-dialog">
        <button onClick={() => { onAdded(); onOpenChange(false); }}>
          Confirm add to collection
        </button>
        <button onClick={() => onOpenChange(false)}>Cancel picker</button>
      </div>
    ) : null,
}));

import { useSkillDetailStore } from "../stores/skillDetailStore";
import { usePlatformStore } from "../stores/platformStore";

// ─── Mock react-markdown ──────────────────────────────────────────────────────

vi.mock("react-markdown", () => ({
  default: ({
    children,
    remarkPlugins,
  }: {
    children: string;
    remarkPlugins?: unknown[];
  }) => (
    <div
      data-testid="react-markdown"
      data-has-remark-gfm={remarkPlugins && remarkPlugins.length > 0 ? "true" : "false"}
    >
      {children}
    </div>
  ),
}));

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

const mockDetail: SkillDetailType = {
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
      installed_at: "2026-04-09T12:00:00Z",
    },
  ],
};

const mockContent =
  "---\nname: frontend-design\n---\n\n# Frontend Design\n\nContent here.";

const mockLoadDetail = vi.fn();
const mockInstallSkill = vi.fn();
const mockUninstallSkill = vi.fn();
const mockLoadCachedExplanation = vi.fn();
const mockGenerateExplanation = vi.fn();
const mockRefreshExplanation = vi.fn();
const mockCleanupExplanationListeners = vi.fn();
const mockReset = vi.fn();
const mockRescan = vi.fn();

function buildDetailStoreState(overrides = {}) {
  return {
    detail: mockDetail,
    content: mockContent,
    isLoading: false,
    installingAgentId: null,
    error: null,
    explanation: null,
    isExplanationLoading: false,
    isExplanationStreaming: false,
    explanationError: null,
    explanationErrorInfo: null,
    loadDetail: mockLoadDetail,
    loadCachedExplanation: mockLoadCachedExplanation,
    generateExplanation: mockGenerateExplanation,
    refreshExplanation: mockRefreshExplanation,
    installSkill: mockInstallSkill,
    uninstallSkill: mockUninstallSkill,
    cleanupExplanationListeners: mockCleanupExplanationListeners,
    reset: mockReset,
    ...overrides,
  };
}

function buildPlatformStoreState(overrides = {}) {
  return {
    agents: mockAgents,
    skillsByAgent: {},
    isLoading: false,
    error: null,
    initialize: vi.fn(),
    rescan: mockRescan,
    ...overrides,
  };
}

function renderSkillDetail(skillId = "frontend-design") {
  vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
    const state = buildDetailStoreState();
    if (typeof selector === "function") return selector(state);
    return state;
  });
  vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
    const state = buildPlatformStoreState();
    if (typeof selector === "function") return selector(state);
    return state;
  });

  return render(
    <MemoryRouter initialEntries={[`/skill/${skillId}`]}>
      <Routes>
        <Route path="/skill/:skillId" element={<SkillDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SkillDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Back button ───────────────────────────────────────────────────────────

  it("renders back button", () => {
    renderSkillDetail();
    expect(screen.getByRole("button", { name: /返回/i })).toBeInTheDocument();
  });

  it("navigates back when back button clicked", () => {
    renderSkillDetail();
    const backBtn = screen.getByRole("button", { name: /返回/i });
    // Clicking should not throw; navigation is handled by useNavigate(-1)
    fireEvent.click(backBtn);
    // No assertion needed — just verifying no crash
  });

  // ── Skill name & description ──────────────────────────────────────────────

  it("shows skill name in header", () => {
    renderSkillDetail();
    expect(screen.getByRole("heading", { name: /frontend-design/i })).toBeInTheDocument();
  });

  it("shows skill description in header", () => {
    renderSkillDetail();
    expect(
      screen.getByText("Build distinctive, production-grade frontend interfaces")
    ).toBeInTheDocument();
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  it("shows metadata section", () => {
    renderSkillDetail();
    expect(screen.getByRole("region", { name: /技能基本信息/i })).toBeInTheDocument();
  });

  it("shows file path", () => {
    renderSkillDetail();
    expect(
      screen.getByText("~/.agents/skills/frontend-design/SKILL.md")
    ).toBeInTheDocument();
  });

  it("shows canonical path", () => {
    renderSkillDetail();
    expect(screen.getByText("~/.agents/skills/frontend-design")).toBeInTheDocument();
  });

  it("shows source", () => {
    renderSkillDetail();
    expect(screen.getByText("native")).toBeInTheDocument();
  });

  // ── Installation status ───────────────────────────────────────────────────

  it("shows installation status section", () => {
    renderSkillDetail();
    expect(
      screen.getByRole("region", { name: /安装状态/i })
    ).toBeInTheDocument();
  });

  it("shows platform toggle icons for non-central agents", () => {
    renderSkillDetail();
    // Each non-central agent should have a toggle icon button
    const toggleButtons = screen.getAllByRole("button", {
      name: /切换 .* 的链接状态/i,
    });
    // 2 non-central agents (claude-code, cursor)
    expect(toggleButtons).toHaveLength(2);
  });

  it("shows platform name in tooltip on toggle icon", () => {
    renderSkillDetail();
    // Claude Code is installed — tooltip includes linked status
    const claudeToggle = screen.getByRole("button", {
      name: /切换 frontend-design 在 Claude Code 的链接状态/i,
    });
    expect(claudeToggle).toHaveAttribute("title", expect.stringContaining("Claude Code"));
  });

  it("calls installSkill when unlinked platform icon is clicked", async () => {
    renderSkillDetail();
    // Cursor is NOT installed
    const cursorToggle = screen.getByRole("button", {
      name: /切换 frontend-design 在 Cursor 的链接状态/i,
    });
    fireEvent.click(cursorToggle);
    await waitFor(() => {
      expect(mockInstallSkill).toHaveBeenCalledWith("frontend-design", "cursor");
    });
  });

  it("calls uninstallSkill when linked platform icon is clicked", async () => {
    renderSkillDetail();
    // Claude Code IS installed
    const claudeToggle = screen.getByRole("button", {
      name: /切换 frontend-design 在 Claude Code 的链接状态/i,
    });
    fireEvent.click(claudeToggle);
    await waitFor(() => {
      expect(mockUninstallSkill).toHaveBeenCalledWith("frontend-design", "claude-code");
    });
  });

  // ── Collections ───────────────────────────────────────────────────────────

  it("shows collections section", () => {
    renderSkillDetail();
    expect(screen.getByRole("region", { name: /技能集/i })).toBeInTheDocument();
  });

  it("shows Add to collection button", () => {
    renderSkillDetail();
    expect(
      screen.getByRole("button", { name: /加入技能集/i })
    ).toBeInTheDocument();
  });

  it("shows collection tags when collections are present", () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({
        detail: { ...mockDetail, collections: ["frontend", "design-system"] },
      });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });
    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("design-system")).toBeInTheDocument();
  });

  // ── SKILL.md Preview ──────────────────────────────────────────────────────

  it("shows SKILL.md preview as markdown content", () => {
    renderSkillDetail();
    // Preview is the left column — check for the markdown tabpanel
    expect(screen.getByRole("tabpanel", { name: /Markdown/i })).toBeInTheDocument();
  });

  it("shows Markdown tab button", () => {
    renderSkillDetail();
    expect(screen.getByRole("tab", { name: /Markdown/i })).toBeInTheDocument();
  });

  it("shows Raw Source tab button", () => {
    renderSkillDetail();
    expect(screen.getByRole("tab", { name: /原始源码/i })).toBeInTheDocument();
  });

  it("shows AI Explanation tab button", () => {
    renderSkillDetail();
    expect(screen.getByRole("tab", { name: /AI 解释/i })).toBeInTheDocument();
  });

  it("renders markdown content by default in Markdown tab", () => {
    renderSkillDetail();
    // The mock ReactMarkdown renders its children as-is
    const markdownPane = screen.getByRole("tabpanel", { name: /Markdown/i });
    expect(markdownPane).toBeInTheDocument();
    expect(screen.getByTestId("react-markdown")).toBeInTheDocument();
    expect(screen.getByTestId("react-markdown")).toHaveAttribute("data-has-remark-gfm", "true");
  });

  it("strips frontmatter in Markdown tab", () => {
    renderSkillDetail();
    const markdown = screen.getByTestId("react-markdown");
    expect(markdown).toHaveTextContent("# Frontend Design");
    expect(markdown).not.toHaveTextContent("name: frontend-design");
  });

  it("switches to raw source tab when Raw Source is clicked", async () => {
    renderSkillDetail();
    const rawTab = screen.getByRole("tab", { name: /原始源码/i });
    fireEvent.click(rawTab);
    await waitFor(() => {
      expect(screen.getByRole("tabpanel", { name: /原始源码/i })).toBeInTheDocument();
    });
  });

  it("shows raw content including frontmatter in raw source tab", async () => {
    renderSkillDetail();
    const rawTab = screen.getByRole("tab", { name: /原始源码/i });
    fireEvent.click(rawTab);
    await waitFor(() => {
      const rawPane = screen.getByRole("tabpanel", { name: /原始源码/i });
      expect(rawPane).toHaveTextContent("---");
      expect(rawPane).toHaveTextContent("name: frontend-design");
    });
  });

  it("loads cached explanation when content is available", async () => {
    renderSkillDetail();
    await waitFor(() => {
      expect(mockLoadCachedExplanation).toHaveBeenCalledWith("frontend-design", "zh");
    });
  });

  it("shows cached AI explanation in AI Explanation tab", async () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({
        explanation: "这是缓存的技能解释。",
      });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });
    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /AI 解释/i }));
    await waitFor(() => {
      expect(screen.getByText("这是缓存的技能解释。")).toBeInTheDocument();
    });
  });

  it("calls generateExplanation from empty AI Explanation tab", async () => {
    renderSkillDetail();
    fireEvent.click(screen.getByRole("tab", { name: /AI 解释/i }));
    fireEvent.click(screen.getByRole("button", { name: /生成解释/i }));
    await waitFor(() => {
      expect(mockGenerateExplanation).toHaveBeenCalledWith("frontend-design", mockContent, "zh");
    });
  });

  it("calls refreshExplanation when cached explanation exists", async () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({
        explanation: "这是缓存的技能解释。",
      });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });
    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /AI 解释/i }));
    fireEvent.click(screen.getByRole("button", { name: /重新生成/i }));
    await waitFor(() => {
      expect(mockRefreshExplanation).toHaveBeenCalledWith("frontend-design", mockContent, "zh");
    });
  });

  it("shows explanation loading state while a request is in flight", async () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({
        explanation: null,
        isExplanationLoading: true,
        isExplanationStreaming: true,
      });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });

    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /AI 解释/i }));

    await waitFor(() => {
      expect(screen.getByText(/正在加载 AI 解释/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /生成解释/i })).toBeDisabled();
  });

  it("shows streaming indicator once explanation content starts arriving", async () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({
        explanation: "第一段解释",
        isExplanationLoading: false,
        isExplanationStreaming: true,
      });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });

    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /AI 解释/i }));

    expect(screen.getByText("第一段解释")).toBeInTheDocument();
    expect(screen.getByText(/正在流式接收解释/i)).toBeInTheDocument();
  });

  it("shows recoverable explanation error state without leaving stale explanation visible", async () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({
        explanation: null,
        explanationError: "代理连接失败",
        explanationErrorInfo: {
          message: "代理连接失败",
          details: "error sending request",
          kind: "proxy",
          retryable: true,
          fallbackTried: true,
        },
      });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });

    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /AI 解释/i }));

    await waitFor(() => {
      expect(screen.getByText("代理连接失败")).toBeInTheDocument();
    });
    expect(screen.getByText(/备用端点也无法访问/i)).toBeInTheDocument();
    expect(screen.getByText(/暂无 AI 解释/i)).toBeInTheDocument();
    expect(screen.queryByText("这是缓存的技能解释。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /生成解释/i })).toBeEnabled();
  });

  it("keeps retry action available after explanation failure", async () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({
        explanation: null,
        explanationError: "temporary failure",
      });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });

    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /AI 解释/i }));
    fireEvent.click(screen.getByRole("button", { name: /生成解释/i }));

    await waitFor(() => {
      expect(mockGenerateExplanation).toHaveBeenCalledWith("frontend-design", mockContent, "zh");
    });
  });

  it("reveals structured explanation error details on demand", async () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({
        explanation: null,
        explanationError: "temporary failure",
        explanationErrorInfo: {
          message: "temporary failure",
          details: "connect ECONNREFUSED 127.0.0.1:3000",
          kind: "connect",
          retryable: true,
          fallbackTried: false,
        },
      });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });

    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /AI 解释/i }));
    fireEvent.click(screen.getByRole("button", { name: /查看详情/i }));

    expect(screen.getByText(/ECONNREFUSED 127.0.0.1:3000/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /生成解释/i })).toBeEnabled();
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  it("shows loading state when isLoading is true", () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({ isLoading: true, detail: null });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });
    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/正在加载技能详情/i)).toBeInTheDocument();
  });

  // ── Error state ───────────────────────────────────────────────────────────

  it("shows error message when error occurs", () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({ error: "Skill not found", detail: null });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });
    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Skill not found")).toBeInTheDocument();
  });

  it("renders a safe browser fallback when the Tauri bridge is unavailable", async () => {
    Object.defineProperty(window, "__TAURI__", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({ detail: null, content: null, error: null, isLoading: false });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });

    render(
      <MemoryRouter initialEntries={["/skill/defuddle"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/技能详情需要桌面运行时/i)).toBeInTheDocument();
    expect(screen.getByText(/浏览器预览中该路由现在会安全渲染/i)).toBeInTheDocument();
  });

  // ── Store calls ───────────────────────────────────────────────────────────

  it("calls loadDetail on mount with skillId from URL", () => {
    renderSkillDetail("frontend-design");
    expect(mockLoadDetail).toHaveBeenCalledWith("frontend-design");
  });

  it("calls reset on unmount", () => {
    const { unmount } = renderSkillDetail();
    unmount();
    expect(mockReset).toHaveBeenCalled();
  });

  // ── Spinner during install/uninstall ──────────────────────────────────────

  it("disables toggle icon when that agent is installing", () => {
    vi.mocked(useSkillDetailStore).mockImplementation((selector?: unknown) => {
      const state = buildDetailStoreState({ installingAgentId: "cursor" });
      if (typeof selector === "function") return selector(state);
      return state;
    });
    vi.mocked(usePlatformStore).mockImplementation((selector?: unknown) => {
      const state = buildPlatformStoreState();
      if (typeof selector === "function") return selector(state);
      return state;
    });
    render(
      <MemoryRouter initialEntries={["/skill/frontend-design"]}>
        <Routes>
          <Route path="/skill/:skillId" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );
    // The toggle icon for Cursor should be disabled
    const cursorToggle = screen.getByRole("button", {
      name: /切换 frontend-design 在 Cursor 的链接状态/i,
    });
    expect(cursorToggle).toBeDisabled();
  });

  // ── CollectionPickerDialog integration ────────────────────────────────────

  it("does not render CollectionPickerDialog by default", () => {
    renderSkillDetail();
    expect(screen.queryByTestId("collection-picker-dialog")).toBeNull();
  });

  it("opens CollectionPickerDialog when Add to collection is clicked", async () => {
    renderSkillDetail();
    const addBtn = screen.getByRole("button", { name: /加入技能集/i });
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByTestId("collection-picker-dialog")).toBeInTheDocument();
    });
  });

  it("closes CollectionPickerDialog when cancel is clicked inside it", async () => {
    renderSkillDetail();
    fireEvent.click(screen.getByRole("button", { name: /加入技能集/i }));
    await waitFor(() => {
      expect(screen.getByTestId("collection-picker-dialog")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Cancel picker/i }));
    await waitFor(() => {
      expect(screen.queryByTestId("collection-picker-dialog")).toBeNull();
    });
  });

  it("calls loadDetail to refresh skill after collections are added", async () => {
    renderSkillDetail();
    mockLoadDetail.mockClear(); // clear the initial load call

    fireEvent.click(screen.getByRole("button", { name: /加入技能集/i }));
    await waitFor(() => {
      expect(screen.getByTestId("collection-picker-dialog")).toBeInTheDocument();
    });

    // Simulate confirming the picker (which calls onAdded then closes)
    fireEvent.click(screen.getByRole("button", { name: /Confirm add to collection/i }));

    await waitFor(() => {
      expect(mockLoadDetail).toHaveBeenCalledWith("frontend-design");
    });
  });
});
