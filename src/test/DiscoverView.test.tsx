import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DiscoverView } from "../pages/DiscoverView";
import { DiscoveredProject, DiscoveredSkill, AgentWithStatus } from "../types";

// Mock stores
vi.mock("../stores/discoverStore", () => ({
  useDiscoverStore: vi.fn(),
}));

vi.mock("../stores/platformStore", () => ({
  usePlatformStore: vi.fn(),
}));

// Mock the InstallDialog (heavy component with sub-dependencies)
vi.mock("../components/central/InstallDialog", () => ({
  InstallDialog: () => <div data-testid="install-dialog">InstallDialog</div>,
}));

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "discover.resultsTitle": "Discovered Project Skills",
        "discover.foundSummary": `${params?.skills ?? 0} skills across ${params?.projects ?? 0} projects`,
        "discover.reScan": "Re-scan",
        "discover.searchPlaceholder": "Search discovered skills...",
        "discover.scanning": "Scanning...",
        "discover.progress": `${params?.percent ?? 0}% — scanning ${params?.path ?? ""}`,
        "discover.foundSoFar": `${params?.skills ?? 0} skills in ${params?.projects ?? 0} projects`,
        "discover.stopAndShow": "Stop & Show Results",
        "discover.noResults": "No project skills discovered yet.",
        "discover.noResultsDesc": 'Click "Discover" to scan your project directories.',
        "discover.noMatch": `No skills match "${params?.query ?? ""}"`,
        "discover.installToCentral": "Install to Central",
        "discover.installToPlatform": "Install to Platform",
        "discover.alreadyCentral": "Already in Central",
        "discover.selected": `${params?.count ?? 0} selected`,
        "discover.installSelectedCentral": "Install selected to Central",
        "discover.deselectAll": "Deselect all",
        "discover.selectSkill": "Select skill",
        "discover.importSuccess": "Skill imported successfully",
        "discover.importError": "Import failed",
        "collection.skills": `Skills (${params?.count ?? 0})`,
      };
      return map[key] ?? key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useDiscoverStore } from "../stores/discoverStore";
import { usePlatformStore } from "../stores/platformStore";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockSkill: DiscoveredSkill = {
  id: "claude-code__my-app__deploy",
  name: "deploy",
  description: "Deploy the application",
  file_path: "/home/user/projects/my-app/.claude/skills/deploy/SKILL.md",
  dir_path: "/home/user/projects/my-app/.claude/skills/deploy",
  platform_id: "claude-code",
  platform_name: "Claude Code",
  project_path: "/home/user/projects/my-app",
  project_name: "my-app",
  is_already_central: false,
};

const mockAlreadyCentralSkill: DiscoveredSkill = {
  id: "cursor__my-app__review",
  name: "review",
  description: "Review code changes",
  file_path: "/home/user/projects/my-app/.cursor/skills/review/SKILL.md",
  dir_path: "/home/user/projects/my-app/.cursor/skills/review",
  platform_id: "cursor",
  platform_name: "Cursor",
  project_path: "/home/user/projects/my-app",
  project_name: "my-app",
  is_already_central: true,
};

const mockProjects: DiscoveredProject[] = [
  {
    project_path: "/home/user/projects/my-app",
    project_name: "my-app",
    skills: [mockSkill, mockAlreadyCentralSkill],
  },
];

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
    id: "central",
    display_name: "Central Skills",
    category: "central",
    global_skills_dir: "~/.agents/skills/",
    is_detected: true,
    is_builtin: true,
    is_enabled: true,
  },
];

const mockLoadDiscoveredSkills = vi.fn();
const mockLoadScanRoots = vi.fn();
const mockImportToCentral = vi.fn();
const mockImportToPlatform = vi.fn();
const mockToggleSkillSelection = vi.fn();
const mockClearSelection = vi.fn();
const mockRescan = vi.fn();
const mockStopScan = vi.fn();

function buildDiscoverStoreState(overrides = {}) {
  return {
    isScanning: false,
    discoveredProjects: mockProjects,
    totalSkillsFound: 2,
    groupBy: "project" as const,
    platformFilter: null as string | null,
    searchQuery: "",
    selectedSkillIds: new Set<string>(),
    scanProgress: 0,
    currentPath: "",
    skillsFoundSoFar: 0,
    projectsFoundSoFar: 0,
    scanRoots: [],
    isLoadingRoots: false,
    loadDiscoveredSkills: mockLoadDiscoveredSkills,
    importToCentral: mockImportToCentral,
    importToPlatform: mockImportToPlatform,
    toggleSkillSelection: mockToggleSkillSelection,
    clearSelection: mockClearSelection,
    setGroupBy: vi.fn(),
    setPlatformFilter: vi.fn(),
    setSearchQuery: vi.fn(),
    loadScanRoots: mockLoadScanRoots,
    startScan: vi.fn(),
    stopScan: mockStopScan,
    setScanRootEnabled: vi.fn(),
    clearResults: vi.fn(),
    selectAllVisible: vi.fn(),
    clearError: vi.fn(),
    error: null,
    lastScanAt: null,
    ...overrides,
  };
}

function buildPlatformStoreState(overrides = {}) {
  return {
    agents: mockAgents,
    rescan: mockRescan,
    ...overrides,
  };
}

// Render with routing that matches App.tsx routes
function renderDiscoverView(initialPath = "/discover") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/discover" element={<DiscoverView />} />
        <Route path="/discover/:projectPath" element={<DiscoverView />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DiscoverView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useDiscoverStore).mockImplementation((selector: any) =>
      selector(buildDiscoverStoreState())
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(usePlatformStore).mockImplementation((selector: any) =>
      selector(buildPlatformStoreState())
    );
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  it("renders the page title", () => {
    renderDiscoverView();
    expect(screen.getByText("Discovered Project Skills")).toBeInTheDocument();
  });

  it("shows discovered skills count in summary", () => {
    renderDiscoverView();
    expect(screen.getByText("2 skills across 1 projects")).toBeInTheDocument();
  });

  it("renders the re-scan button", () => {
    renderDiscoverView();
    expect(screen.getByText("Re-scan")).toBeInTheDocument();
  });

  it("renders project list in left panel", () => {
    renderDiscoverView();
    // "my-app" appears in both the project list and the detail header
    expect(screen.getAllByText("my-app").length).toBeGreaterThanOrEqual(1);
  });

  // ── Loading cached results on mount ──────────────────────────────────────

  it("calls loadDiscoveredSkills on mount", () => {
    renderDiscoverView();
    expect(mockLoadDiscoveredSkills).toHaveBeenCalled();
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  it("shows empty state when no discovered projects", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useDiscoverStore).mockImplementation((selector: any) =>
      selector(buildDiscoverStoreState({
        discoveredProjects: [],
        totalSkillsFound: 0,
      }))
    );

    renderDiscoverView();
    expect(screen.getByText("No project skills discovered yet.")).toBeInTheDocument();
  });

  // ── Scanning state ─────────────────────────────────────────────────────────

  it("shows progress view during scan", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useDiscoverStore).mockImplementation((selector: any) =>
      selector(buildDiscoverStoreState({ isScanning: true }))
    );

    renderDiscoverView();
    expect(screen.getByText("Scanning...")).toBeInTheDocument();
    expect(screen.getByText("Stop & Show Results")).toBeInTheDocument();
  });

  it("stop button calls stopScan when clicked during active scan", async () => {
    mockStopScan.mockResolvedValueOnce(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useDiscoverStore).mockImplementation((selector: any) =>
      selector(buildDiscoverStoreState({ isScanning: true }))
    );

    renderDiscoverView();

    const stopBtn = screen.getByRole("button", { name: /stop & show results/i });
    expect(stopBtn).toBeVisible();
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(mockStopScan).toHaveBeenCalled();
    });
  });

  // ── Skill cards (with project selected via route) ─────────────────────────

  it("renders discovered skill cards when project is selected", () => {
    const encoded = encodeURIComponent("/home/user/projects/my-app");
    renderDiscoverView(`/discover/${encoded}`);
    expect(screen.getByText("deploy")).toBeInTheDocument();
    expect(screen.getByText("review")).toBeInTheDocument();
  });

  it("shows 'Already in Central' badge for already-central skills", () => {
    const encoded = encodeURIComponent("/home/user/projects/my-app");
    renderDiscoverView(`/discover/${encoded}`);
    expect(screen.getByText("Already in Central")).toBeInTheDocument();
  });

  // ── Selection ──────────────────────────────────────────────────────────────

  it("shows selection action bar when skills are selected", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useDiscoverStore).mockImplementation((selector: any) =>
      selector(buildDiscoverStoreState({
        selectedSkillIds: new Set(["claude-code__my-app__deploy"]),
      }))
    );

    const encoded = encodeURIComponent("/home/user/projects/my-app");
    renderDiscoverView(`/discover/${encoded}`);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByText("Install selected to Central")).toBeInTheDocument();
    expect(screen.getByText("Deselect all")).toBeInTheDocument();
  });

  // ── Install to Central ─────────────────────────────────────────────────────

  it("calls importToCentral when install-to-central button is clicked", async () => {
    mockImportToCentral.mockResolvedValueOnce({ skill_id: "deploy", target: "central" });
    mockRescan.mockResolvedValueOnce(undefined);

    const encoded = encodeURIComponent("/home/user/projects/my-app");
    renderDiscoverView(`/discover/${encoded}`);

    const installBtn = screen.getAllByTitle("Install to Central")[0];
    fireEvent.click(installBtn);

    await waitFor(() => {
      expect(mockImportToCentral).toHaveBeenCalledWith("claude-code__my-app__deploy");
    });
  });
});
