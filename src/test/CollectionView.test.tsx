import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CollectionView } from "../pages/CollectionView";
import { CollectionDetail, AgentWithStatus } from "../types";

// Mock stores
vi.mock("../stores/collectionStore", () => ({
  useCollectionStore: vi.fn(),
}));

vi.mock("../stores/platformStore", () => ({
  usePlatformStore: vi.fn(),
}));

import { useCollectionStore } from "../stores/collectionStore";
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

const mockCollectionDetail: CollectionDetail = {
  id: "col-1",
  name: "Frontend",
  description: "Frontend skills collection",
  created_at: "2026-04-09T00:00:00Z",
  updated_at: "2026-04-09T00:00:00Z",
  skills: [
    {
      id: "frontend-design",
      name: "frontend-design",
      description: "Build distinctive frontend UIs",
      file_path: "~/.agents/skills/frontend-design/SKILL.md",
      is_central: true,
      scanned_at: "2026-04-09T00:00:00Z",
    },
    {
      id: "code-reviewer",
      name: "code-reviewer",
      description: "Review code changes",
      file_path: "~/.agents/skills/code-reviewer/SKILL.md",
      is_central: true,
      scanned_at: "2026-04-09T00:00:00Z",
    },
  ],
};

const mockLoadCollectionDetail = vi.fn();
const mockRemoveSkillFromCollection = vi.fn();
const mockDeleteCollection = vi.fn();
const mockExportCollection = vi.fn();

function buildCollectionStoreState(overrides = {}) {
  return {
    collections: [],
    currentDetail: mockCollectionDetail,
    isLoading: false,
    isLoadingDetail: false,
    error: null,
    loadCollections: vi.fn(),
    createCollection: vi.fn(),
    updateCollection: vi.fn(),
    deleteCollection: mockDeleteCollection,
    loadCollectionDetail: mockLoadCollectionDetail,
    addSkillToCollection: vi.fn(),
    removeSkillFromCollection: mockRemoveSkillFromCollection,
    batchInstallCollection: vi.fn(),
    exportCollection: mockExportCollection,
    importCollection: vi.fn(),
    refreshCounts: vi.fn(),
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
    rescan: vi.fn(),
    refreshCounts: vi.fn(),
    ...overrides,
  };
}

function renderCollectionView(collectionId = "col-1", storeOverrides = {}) {
  vi.mocked(useCollectionStore).mockImplementation((selector) =>
    selector(buildCollectionStoreState(storeOverrides))
  );
  vi.mocked(usePlatformStore).mockImplementation((selector) =>
    selector(buildPlatformStoreState())
  );

  return render(
    <MemoryRouter initialEntries={[`/collection/${collectionId}`]}>
      <Routes>
        <Route path="/collection/:collectionId" element={<CollectionView />} />
        <Route path="/central" element={<div>Central Skills</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CollectionView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading and Data Display ───────────────────────────────────────────────

  it("calls loadCollectionDetail on mount", () => {
    renderCollectionView("col-1");
    expect(mockLoadCollectionDetail).toHaveBeenCalledWith("col-1");
  });

  it("renders collection name and description", () => {
    renderCollectionView();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Frontend skills collection")).toBeInTheDocument();
  });

  it("renders member skills list", () => {
    renderCollectionView();
    expect(screen.getByText("frontend-design")).toBeInTheDocument();
    expect(screen.getByText("code-reviewer")).toBeInTheDocument();
  });

  it("shows loading state when isLoadingDetail is true", () => {
    renderCollectionView("col-1", { isLoadingDetail: true, currentDetail: null });
    expect(screen.getByText(/正在加载技能集/i)).toBeInTheDocument();
  });

  it("shows empty skills state when collection has no skills", () => {
    renderCollectionView("col-1", {
      currentDetail: { ...mockCollectionDetail, skills: [] },
    });
    expect(screen.getByText(/此技能集还没有技能/i)).toBeInTheDocument();
  });

  // ── Remove Skill ───────────────────────────────────────────────────────────

  it("calls removeSkillFromCollection when remove button is clicked", async () => {
    mockRemoveSkillFromCollection.mockResolvedValueOnce(undefined);
    renderCollectionView();

    const removeButtons = screen.getAllByRole("button", { name: /从技能集中移除/i });
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockRemoveSkillFromCollection).toHaveBeenCalledWith("col-1", "frontend-design");
    });
  });

  // ── Action Buttons ─────────────────────────────────────────────────────────

  it("renders Edit, Delete, Export, Add Skill, and Batch Install buttons", () => {
    renderCollectionView();
    expect(screen.getByRole("button", { name: /编辑技能集/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /删除技能集/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /导出技能集/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /添加技能到技能集/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /批量安装技能集/i })).toBeInTheDocument();
  });

  // ── Export ────────────────────────────────────────────────────────────────

  it("calls exportCollection when Export button is clicked", async () => {
    mockExportCollection.mockResolvedValueOnce(
      JSON.stringify({ version: 1, name: "Frontend", skills: ["frontend-design"] })
    );

    // Mock URL.createObjectURL and anchor click
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window, "URL", {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    });

    renderCollectionView();
    const exportButton = screen.getByRole("button", { name: /导出技能集/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockExportCollection).toHaveBeenCalledWith("col-1");
    });
  });

  // ── Error State ───────────────────────────────────────────────────────────

  it("shows error when loading fails", () => {
    renderCollectionView("col-1", {
      currentDetail: null,
      isLoadingDetail: false,
      error: "Collection not found",
    });
    expect(screen.getByText(/Collection not found/i)).toBeInTheDocument();
  });
});
