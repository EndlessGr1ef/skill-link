import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  RefreshCw,
  Loader2,
  Download,
  FileText,
  Plus,
  X,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnifiedSkillCard } from "@/components/skill/UnifiedSkillCard";
import { useMarketplaceStore } from "@/stores/marketplaceStore";
import { usePlatformStore } from "@/stores/platformStore";
import { useCentralSkillsStore } from "@/stores/centralSkillsStore";
import { useSkillStore } from "@/stores/skillStore";
import {
  RECOMMENDED_SKILLS,
  ALL_TAGS,
  TAG_LABELS,
  SkillTag,
} from "@/data/officialSources";
import { MarketplaceSkillDetailDrawer, type MarketplaceSkillDetail } from "@/components/marketplace/MarketplaceSkillDetailDrawer";
import { GitRepoImportWizard } from "@/components/marketplace/GitRepoImportWizard";
import { invoke } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import type { MarketplaceSkill, SkillRegistry, SkillsShFileEntry, SkillsShSkill } from "@/types";

// Tab ID: built-in tabs + dynamic custom registry IDs
type TabId = "recommended" | "skillfind" | `custom:${string}`;

// ─── Add Custom Market Dialog ─────────────────────────────────────────────

function AddCustomMarketDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, url: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const lang = i18n.language;
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function deriveNameFromUrl(inputUrl: string): string {
    try {
      const parsed = new URL(inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`);
      const parts = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
      if (parts.length >= 2) return parts[parts.length - 1];
      return parsed.hostname;
    } catch {
      return inputUrl;
    }
  }

  async function handleAdd() {
    if (!url.trim()) return;
    const finalName = name.trim() || deriveNameFromUrl(url.trim());
    setIsAdding(true);
    setError(null);
    try {
      await onAdd(finalName, url.trim());
      setName("");
      setUrl("");
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsAdding(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
      <div
        className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">
          {lang === "zh" ? "添加自定义市场" : "Add Custom Market"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {lang === "zh"
            ? "输入 Git 仓库地址，将其作为独立的技能市场 Tab 添加。"
            : "Enter a Git repo URL to add it as an independent skill market tab."}
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">
              {lang === "zh" ? "仓库 URL" : "Repository URL"}
            </label>
            <Input
              placeholder="https://github.com/user/skills-repo"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (!name.trim()) {
                  setName(deriveNameFromUrl(e.target.value));
                }
              }}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              {lang === "zh" ? "显示名称" : "Display Name"}
            </label>
            <Input
              placeholder={lang === "zh" ? "自动从 URL 推导" : "Auto-derived from URL"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleAdd} disabled={!url.trim() || isAdding}>
            {isAdding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            <span>{lang === "zh" ? "添加" : "Add"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Market Tab Content ────────────────────────────────────────────

function CustomMarketContent({
  registry,
  skills,
  isSyncing,
  onSync,
  onInstall,
  installingIds,
  onOpenDetail,
}: {
  registry: SkillRegistry;
  skills: MarketplaceSkill[];
  isSyncing: boolean;
  onSync: () => void;
  onInstall: (skillId: string) => Promise<void>;
  installingIds: Set<string>;
  onOpenDetail: (skill: MarketplaceSkillDetail, trigger?: EventTarget | null) => void;
}) {
  const lang = i18n.language;

  if (skills.length === 0 && !isSyncing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground gap-3">
        <GitBranch className="size-8 text-muted-foreground/50" />
        <div>
          {lang === "zh" ? "该市场暂无缓存技能" : "No cached skills for this market"}
        </div>
        <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          <span>{lang === "zh" ? "同步" : "Sync"}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate max-w-[70%]">
          {registry.url}
        </span>
        <Button variant="ghost" size="sm" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          <span>{lang === "zh" ? "同步" : "Sync"}</span>
        </Button>
      </div>
      {isSyncing && skills.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          {lang === "zh" ? "正在同步..." : "Syncing..."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {skills.map((skill) => (
            <UnifiedSkillCard
              key={skill.id}
              name={skill.name}
              description={skill.description ?? undefined}
              publisher={registry.name}
              onDetail={(event) =>
                onOpenDetail(
                  {
                    id: skill.id,
                    name: skill.name,
                    description: skill.description ?? undefined,
                    downloadUrl: skill.download_url,
                    publisher: registry.name,
                    sourceLabel: registry.name,
                    sourceUrl: registry.url,
                    installed: skill.is_installed,
                    sourceType: "git",
                    sourcePath: skill.source_path ?? undefined,
                  },
                  event?.currentTarget ?? null
                )
              }
              onInstall={installingIds.has(skill.id) ? undefined : () => onInstall(skill.id)}
              isLoading={installingIds.has(skill.id)}
              isInstalled={skill.is_installed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MarketplaceView ─────────────────────────────────────────────────────

export function MarketplaceView() {
  const { t } = useTranslation();
  const lang = i18n.language;

  // Store
  const registries = useMarketplaceStore((s) => s.registries);
  const installingIds = useMarketplaceStore((s) => s.installingIds);
  const loadRegistries = useMarketplaceStore((s) => s.loadRegistries);
  const installSkill = useMarketplaceStore((s) => s.installSkill);
  const githubImport = useMarketplaceStore((s) => s.githubImport);
  const previewGitHubRepoImport = useMarketplaceStore((s) => s.previewGitHubRepoImport);
  const importGitHubRepoSkills = useMarketplaceStore((s) => s.importGitHubRepoSkills);
  const resetGitHubImport = useMarketplaceStore((s) => s.resetGitHubImport);
  const setGitHubImportBranch = useMarketplaceStore((s) => s.setGitHubImportBranch);
  const skillsShResults = useMarketplaceStore((s) => s.skillsShResults);
  const isSkillsShLoading = useMarketplaceStore((s) => s.isSkillsShLoading);
  const searchSkillsSh = useMarketplaceStore((s) => s.searchSkillsSh);
  const installFromSkillsSh = useMarketplaceStore((s) => s.installFromSkillsSh);
  // Custom market
  const customSkillsByRegistry = useMarketplaceStore((s) => s.customSkillsByRegistry);
  const isCustomSyncing = useMarketplaceStore((s) => s.isCustomSyncing);
  const syncCustomRegistry = useMarketplaceStore((s) => s.syncCustomRegistry);
  const loadCustomSkills = useMarketplaceStore((s) => s.loadCustomSkills);
  const removeCustomRegistry = useMarketplaceStore((s) => s.removeCustomRegistry);
  const addRegistry = useMarketplaceStore((s) => s.addRegistry);

  const rescan = usePlatformStore((s) => s.rescan);
  const platformAgents = usePlatformStore((s) => s.agents);
  const centralSkills = useCentralSkillsStore((s) => s.skills);
  const centralAgents = useCentralSkillsStore((s) => s.agents);
  const loadCentralSkills = useCentralSkillsStore((s) => s.loadCentralSkills);
  const installCentralSkill = useCentralSkillsStore((s) => s.installSkill);
  const skillsByAgent = useSkillStore((s) => s.skillsByAgent);
  const getSkillsByAgent = useSkillStore((s) => s.getSkillsByAgent);

  // Local state
  const [activeTab, setActiveTab] = useState<TabId>("recommended");
  const [selectedTag, setSelectedTag] = useState<SkillTag | null>(null);
  const [recommendedSearch, setRecommendedSearch] = useState("");
  const [skillsShSearch, setSkillsShSearch] = useState("");
  const [detailSkill, setDetailSkill] = useState<MarketplaceSkillDetail | null>(null);
  const [isGitHubImportOpen, setIsGitHubImportOpen] = useState(false);
  const [githubRepoUrl, setGitHubRepoUrl] = useState("");
  const [resolvingSkillsShUrls, setResolvingSkillsShUrls] = useState<Set<string>>(new Set());
  const [isAddCustomMarketOpen, setIsAddCustomMarketOpen] = useState(false);
  const [hoveredCustomTab, setHoveredCustomTab] = useState<string | null>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);

  // Custom registries (git source_type)
  const customRegistries = useMemo(
    () => registries.filter((r) => r.source_type === "git"),
    [registries]
  );

  useEffect(() => {
    loadRegistries();
  }, [loadRegistries]);

  // Load cached skills for custom registries on first load
  useEffect(() => {
    for (const reg of customRegistries) {
      if (!customSkillsByRegistry[reg.id]) {
        loadCustomSkills(reg.id);
      }
    }
  }, [customRegistries, customSkillsByRegistry, loadCustomSkills]);

  // Recommended skills filtered by tag and search
  const filteredRecommended = useMemo(() => {
    let list = RECOMMENDED_SKILLS;
    if (selectedTag) {
      list = list.filter((s) => s.tags.includes(selectedTag));
    }
    if (recommendedSearch.trim()) {
      const q = recommendedSearch.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.publisher.toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedTag, recommendedSearch]);

  // ── Handlers ───────────────────────────────────────────────────────────

  async function handleInstallFromSource(skillId: string) {
    try {
      await installSkill(skillId);
      await rescan();
      setDetailSkill((current) =>
        current && current.id === skillId ? { ...current, installed: true } : current
      );
      toast.success(t("marketplace.installSuccess"));
    } catch (err) {
      toast.error(String(err));
    }
  }

  async function handleInstallSkillsSh(source: string, skillId: string) {
    try {
      await installFromSkillsSh(source, skillId);
      await rescan();
      setDetailSkill((current) =>
        current && current.id === `skillssh:${source}:${skillId}`
          ? { ...current, installed: true }
          : current
      );
      toast.success(t("marketplace.installSuccess"));
    } catch (err) {
      toast.error(String(err));
    }
  }

  function openDetailSkill(skill: MarketplaceSkillDetail, trigger?: EventTarget | null) {
    if (trigger instanceof HTMLElement) {
      detailTriggerRef.current = trigger;
    }
    setDetailSkill(skill);
  }

  async function handleGitHubPreview() {
    try {
      return await previewGitHubRepoImport(githubRepoUrl, githubImport.branch);
    } catch {
      return null;
    }
  }

  async function handleGitHubImport(selections: Parameters<typeof importGitHubRepoSkills>[1]) {
    try {
      const result = await importGitHubRepoSkills(githubRepoUrl, selections, githubImport.branch);
      await Promise.all([rescan(), loadRegistries(), loadCentralSkills()]);
      toast.success(
        lang === "zh" ? "Git 仓库技能已导入中央技能库" : "Git repo skills imported to Central"
      );
      return result;
    } catch (err) {
      toast.error(String(err));
      throw err;
    }
  }

  const installableImportedSkills = useMemo(() => {
    if (!githubImport.importResult) return [];
    const importedIds = new Set(
      githubImport.importResult.importedSkills.map((skill) => skill.importedSkillId)
    );
    return centralSkills.filter((skill) => importedIds.has(skill.id));
  }, [centralSkills, githubImport.importResult]);

  const availableInstallAgents = useMemo(
    () => (centralAgents.length > 0 ? centralAgents : platformAgents),
    [centralAgents, platformAgents]
  );

  async function handleInstallImportedSkill(
    skillId: string,
    agentIds: string[],
    method: "symlink" | "copy"
  ) {
    await installCentralSkill(skillId, agentIds, method);
    await Promise.all([rescan(), loadCentralSkills(), ...agentIds.map((agentId) => getSkillsByAgent(agentId))]);
  }

  async function handleAfterImportSuccess() {
    const agentIds = Object.keys(skillsByAgent);
    if (agentIds.length === 0) return;
    await Promise.all(agentIds.map((agentId) => getSkillsByAgent(agentId)));
  }

  async function handleAddCustomMarket(name: string, url: string) {
    const registry = await addRegistry(name, "git", url);
    // Sync immediately to fetch skills
    await syncCustomRegistry(registry.id);
    // Switch to the new tab
    setActiveTab(`custom:${registry.id}`);
  }

  async function handleDeleteCustomMarket(registryId: string) {
    try {
      await removeCustomRegistry(registryId);
      if (activeTab === `custom:${registryId}`) {
        setActiveTab("recommended");
      }
    } catch (err) {
      toast.error(String(err));
    }
  }

  async function handleInstallCustomSkill(registryId: string, skillId: string) {
    try {
      await installSkill(skillId);
      await rescan();
      setDetailSkill((current) =>
        current && current.id === skillId ? { ...current, installed: true } : current
      );
      // Mark as installed in local cache
      useMarketplaceStore.setState((s) => {
        const skills = s.customSkillsByRegistry[registryId] ?? [];
        return {
          customSkillsByRegistry: {
            ...s.customSkillsByRegistry,
            [registryId]: skills.map((sk) =>
              sk.id === skillId ? { ...sk, is_installed: true } : sk
            ),
          },
        };
      });
      toast.success(t("marketplace.installSuccess"));
    } catch (err) {
      toast.error(String(err));
    }
  }

  // ── Tabs ───────────────────────────────────────────────────────────────

  const builtinTabs: { id: TabId; label: string }[] = [
    { id: "recommended", label: lang === "zh" ? "推荐" : "Recommended" },
    { id: "skillfind", label: "Skill Find" },
  ];

  const customTabs: { id: TabId; label: string; registryId: string }[] = customRegistries.map(
    (reg) => ({
      id: `custom:${reg.id}` as TabId,
      label: reg.name,
      registryId: reg.id,
    })
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{t("marketplace.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("marketplace.desc")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsAddCustomMarketOpen(true)}>
              <Plus className="size-4" />
              <span>{lang === "zh" ? "添加自定义市场" : "Add Custom Market"}</span>
            </Button>
            <Button onClick={() => setIsGitHubImportOpen(true)}>
              <Download className="size-4" />
              <span>{t("marketplace.githubImportCta")}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-border">
        {builtinTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm transition-colors cursor-pointer",
              activeTab === tab.id
                ? "bg-primary/15 text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted/40"
            )}
          >
            {tab.label}
          </button>
        ))}
        {customTabs.length > 0 && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            {customTabs.map((tab) => (
              <div
                key={tab.id}
                className="relative group"
                onMouseEnter={() => setHoveredCustomTab(tab.registryId)}
                onMouseLeave={() => setHoveredCustomTab(null)}
              >
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-sm transition-colors cursor-pointer pr-7",
                    activeTab === tab.id
                      ? "bg-primary/15 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  {tab.label}
                </button>
                {hoveredCustomTab === tab.registryId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCustomMarket(tab.registryId);
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    aria-label={lang === "zh" ? "删除市场" : "Remove market"}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">

        {/* ── Tab: Recommended ──────────────────────────────────────────── */}
        {activeTab === "recommended" && (
          <div className="p-6 space-y-4">
            {/* Tags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedTag(null)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs transition-colors cursor-pointer",
                  !selectedTag ? "bg-primary/15 text-foreground font-medium" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                )}
              >
                All
              </button>
              {ALL_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs transition-colors cursor-pointer",
                    selectedTag === tag ? "bg-primary/15 text-foreground font-medium" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {lang === "zh" ? TAG_LABELS[tag].zh : TAG_LABELS[tag].en}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={t("marketplace.searchPlaceholder")}
                value={recommendedSearch}
                onChange={(e) => setRecommendedSearch(e.target.value)}
                className="pl-8 h-8 text-sm bg-muted/40"
              />
            </div>

            {/* Skills grid */}
            {filteredRecommended.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {lang === "zh" ? "没有匹配的推荐技能" : "No matching recommended skills"}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredRecommended.map((skill) => (
                  <UnifiedSkillCard
                    key={skill.name}
                    name={skill.name}
                    description={skill.description}
                    publisher={skill.publisher}
                    tags={skill.tags.slice(0, 2).map((tag) => ({
                      key: tag,
                      label: lang === "zh" ? TAG_LABELS[tag].zh : TAG_LABELS[tag].en,
                    }))}
                    onDetail={(event) =>
                      openDetailSkill(
                        {
                          id: skill.name,
                          name: skill.name,
                          description: skill.description,
                          downloadUrl: skill.downloadUrl,
                          publisher: skill.publisher,
                          sourceLabel: skill.publisher,
                          sourceUrl: `https://github.com/${skill.repoFullName}`,
                          installed: false,
                        },
                        event?.currentTarget ?? null
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Skill Find (skills.sh) ──────────────────────────────── */}
        {activeTab === "skillfind" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={lang === "zh" ? "搜索 skills.sh..." : "Search skills.sh..."}
                  value={skillsShSearch}
                  onChange={(e) => setSkillsShSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && skillsShSearch.trim()) {
                      void searchSkillsSh(skillsShSearch.trim());
                    }
                  }}
                  className="pl-8 h-8 text-sm bg-muted/40"
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (skillsShSearch.trim()) {
                    void searchSkillsSh(skillsShSearch.trim());
                  }
                }}
                disabled={isSkillsShLoading || !skillsShSearch.trim()}
              >
                {isSkillsShLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                <span>{lang === "zh" ? "搜索" : "Search"}</span>
              </Button>
            </div>

            {skillsShResults.length === 0 && !isSkillsShLoading && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {lang === "zh" ? "输入关键词搜索 skills.sh" : "Enter keywords to search skills.sh"}
              </div>
            )}

            {isSkillsShLoading && skillsShResults.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" />
                {lang === "zh" ? "搜索中..." : "Searching..."}
              </div>
            )}

            <div className="space-y-2">
              {skillsShResults.map((skill: SkillsShSkill) => {
                const isInstalling = installingIds.has(skill.skill_id);
                const starCount = skill.stars ?? skill.installs;
                const starText =
                  starCount >= 1_000_000
                    ? `${(starCount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
                    : starCount >= 1_000
                      ? `${(starCount / 1_000).toFixed(1).replace(/\.0$/, "")}K`
                      : `${starCount}`;
                return (
                  <div
                    key={skill.id}
                    className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{skill.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        ★ {starText} · {skill.source}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={resolvingSkillsShUrls.has(skill.skill_id)}
                        onClick={async () => {
                          setResolvingSkillsShUrls((prev) => new Set(prev).add(skill.skill_id));
                          try {
                            const [downloadUrl, files] = await Promise.all([
                              invoke<string>("resolve_skills_sh_url", {
                                source: skill.source,
                                skillId: skill.skill_id,
                              }),
                              invoke<SkillsShFileEntry[]>("browse_skills_sh_directory", {
                                source: skill.source,
                                skillId: skill.skill_id,
                              }).catch(() => undefined),
                            ]);
                            openDetailSkill({
                              id: `skillssh:${skill.source}:${skill.skill_id}`,
                              name: skill.name,
                              downloadUrl,
                              publisher: skill.source,
                              sourceLabel: "skills.sh",
                              sourceUrl: `https://github.com/${skill.source}`,
                              installed: false,
                              files,
                            });
                          } catch (err) {
                            toast.error(String(err));
                          } finally {
                            setResolvingSkillsShUrls((prev) => {
                              const next = new Set(prev);
                              next.delete(skill.skill_id);
                              return next;
                            });
                          }
                        }}
                        className="h-7 text-xs px-2"
                      >
                        {resolvingSkillsShUrls.has(skill.skill_id) ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <FileText className="size-3" />
                        )}
                        <span>{t("common.detail")}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleInstallSkillsSh(skill.source, skill.skill_id)}
                        disabled={isInstalling}
                      >
                        {isInstalling ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Download className="size-4" />
                        )}
                        <span>{t("marketplace.install")}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tab: Custom Markets (dynamic) ────────────────────────────── */}
        {customTabs.map((tab) => {
          if (activeTab !== tab.id) return null;
          const registry = customRegistries.find((r) => r.id === tab.registryId);
          if (!registry) return null;
          const skills = customSkillsByRegistry[tab.registryId] ?? [];
          return (
            <CustomMarketContent
              key={tab.registryId}
              registry={registry}
              skills={skills}
              isSyncing={isCustomSyncing.has(tab.registryId)}
              onSync={() => syncCustomRegistry(tab.registryId)}
              onInstall={(skillId) => handleInstallCustomSkill(tab.registryId, skillId)}
              installingIds={installingIds}
              onOpenDetail={openDetailSkill}
            />
          );
        })}

      </div>

      {/* Skill Detail Drawer */}
      {detailSkill && (
        <MarketplaceSkillDetailDrawer
          open={!!detailSkill}
          onOpenChange={(open) => { if (!open) setDetailSkill(null); }}
          skill={detailSkill}
          onInstall={() => {
            if (detailSkill.id.startsWith("skill-")) {
              void handleInstallFromSource(detailSkill.id);
            } else if (detailSkill.id.startsWith("skillssh:")) {
              const parts = detailSkill.id.split(":");
              void handleInstallSkillsSh(parts[1], parts.slice(2).join(":"));
            } else {
              // Custom market or other — use the general install flow
              void handleInstallFromSource(detailSkill.id);
            }
          }}
          isInstalling={(() => {
            if (detailSkill.id.startsWith("skillssh:")) {
              const parts = detailSkill.id.split(":");
              const rawId = parts.slice(2).join(":");
              return installingIds.has(rawId);
            }
            return installingIds.has(detailSkill.id);
          })()}
          onAfterCloseFocus={() => {
            detailTriggerRef.current?.focus();
            detailTriggerRef.current = null;
          }}
        />
      )}

      <GitRepoImportWizard
        open={isGitHubImportOpen}
        onOpenChange={setIsGitHubImportOpen}
        repoUrl={githubRepoUrl}
        onRepoUrlChange={setGitHubRepoUrl}
        branch={githubImport.branch}
        onBranchChange={setGitHubImportBranch}
        preview={githubImport.preview}
        previewError={githubImport.error}
        isPreviewLoading={githubImport.isPreviewLoading}
        isImporting={githubImport.isImporting}
        importResult={githubImport.importResult}
        onPreview={handleGitHubPreview}
        onImport={handleGitHubImport}
        availableAgents={availableInstallAgents}
        installableSkills={installableImportedSkills}
        onInstallImportedSkill={handleInstallImportedSkill}
        onAfterImportSuccess={handleAfterImportSuccess}
        onReset={() => {
          resetGitHubImport();
          setGitHubRepoUrl("");
        }}
        launcherLabel={t("marketplace.title")}
      />

      <AddCustomMarketDialog
        open={isAddCustomMarketOpen}
        onOpenChange={setIsAddCustomMarketOpen}
        onAdd={handleAddCustomMarket}
      />
    </div>
  );
}
