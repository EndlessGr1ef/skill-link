import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Radar,
  RefreshCw,
  Loader2,
  Folder,
  ArrowUpRight,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DiscoverConfigDialog } from "@/components/discover/DiscoverConfigDialog";
import { UnifiedSkillCard } from "@/components/skill/UnifiedSkillCard";
import { InstallDialog } from "@/components/central/InstallDialog";
import { useDiscoverStore } from "@/stores/discoverStore";
import { usePlatformStore } from "@/stores/platformStore";
import { DiscoveredSkill, SkillWithLinks } from "@/types";
import { cn } from "@/lib/utils";

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
      <div className="p-4 rounded-full bg-muted/60">
        <Radar className="size-12 text-muted-foreground opacity-60" />
      </div>
      <p className="text-sm text-muted-foreground font-medium">
        {t("discover.noResults")}
      </p>
      <p className="text-xs text-muted-foreground text-center max-w-sm">
        {t("discover.noResultsDesc")}
      </p>
    </div>
  );
}

// ─── ProgressView ─────────────────────────────────────────────────────────────

function ProgressView() {
  const { t } = useTranslation();
  const scanProgress = useDiscoverStore((s) => s.scanProgress);
  const currentPath = useDiscoverStore((s) => s.currentPath);
  const skillsFoundSoFar = useDiscoverStore((s) => s.skillsFoundSoFar);
  const projectsFoundSoFar = useDiscoverStore((s) => s.projectsFoundSoFar);
  const stopScan = useDiscoverStore((s) => s.stopScan);

  return (
    <div className="space-y-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        <span className="font-medium">{t("discover.scanning")}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${scanProgress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("discover.progress", { percent: scanProgress, path: currentPath })}</span>
        <span>
          {t("discover.foundSoFar", {
            skills: skillsFoundSoFar,
            projects: projectsFoundSoFar,
          })}
        </span>
      </div>

      <div className="flex justify-center pt-2">
        <Button variant="destructive" size="default" onClick={stopScan}>
          <StopCircle className="size-4 mr-1.5" />
          {t("discover.stopAndShow")}
        </Button>
      </div>
    </div>
  );
}

// ─── DiscoverView ─────────────────────────────────────────────────────────────

export function DiscoverView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectPath } = useParams<{ projectPath: string }>();

  // Store state
  const isScanning = useDiscoverStore((s) => s.isScanning);
  const discoveredProjects = useDiscoverStore((s) => s.discoveredProjects);
  const totalSkillsFound = useDiscoverStore((s) => s.totalSkillsFound);
  const selectedSkillIds = useDiscoverStore((s) => s.selectedSkillIds);
  const loadDiscoveredSkills = useDiscoverStore((s) => s.loadDiscoveredSkills);
  const refreshDiscoverCounts = useDiscoverStore((s) => s.refreshCounts);
  const importToCentral = useDiscoverStore((s) => s.importToCentral);
  const importToPlatform = useDiscoverStore((s) => s.importToPlatform);
  const toggleSkillSelection = useDiscoverStore((s) => s.toggleSkillSelection);
  const clearSelection = useDiscoverStore((s) => s.clearSelection);
  const loadScanRoots = useDiscoverStore((s) => s.loadScanRoots);

  const agents = usePlatformStore((s) => s.agents);
  const refreshCounts = usePlatformStore((s) => s.refreshCounts);

  // Local state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());
  const [installTargetSkill, setInstallTargetSkill] =
    useState<DiscoveredSkill | null>(null);
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [skillSearch, setSkillSearch] = useState("");

  // Load persisted results on mount.
  useEffect(() => {
    loadDiscoveredSkills();
  }, [loadDiscoveredSkills]);

  // Auto-select first project when none is selected and projects exist.
  useEffect(() => {
    if (!projectPath && discoveredProjects.length > 0) {
      navigate(`/discover/${encodeURIComponent(discoveredProjects[0].project_path)}`, { replace: true });
    }
  }, [projectPath, discoveredProjects, navigate]);

  // Filtered project list for the left panel.
  const filteredProjectList = useMemo(() => {
    if (!projectSearch.trim()) return discoveredProjects;
    const q = projectSearch.toLowerCase();
    return discoveredProjects.filter(
      (p) => p.project_name.toLowerCase().includes(q) || p.project_path.toLowerCase().includes(q)
    );
  }, [discoveredProjects, projectSearch]);

  // Currently selected project.
  const selectedProject = useMemo(() => {
    if (!projectPath) return null;
    const decoded = decodeURIComponent(projectPath);
    return discoveredProjects.find((p) => p.project_path === decoded) ?? null;
  }, [discoveredProjects, projectPath]);

  // Skills for the selected project, filtered by skill search.
  const displayedSkills = useMemo(() => {
    if (!selectedProject) return [];
    if (!skillSearch.trim()) return selectedProject.skills;
    const q = skillSearch.toLowerCase();
    return selectedProject.skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
    );
  }, [selectedProject, skillSearch]);

  // Available platform agents for install dialog.
  const platformAgents = useMemo(
    () => agents.filter((a) => a.id !== "central" && a.is_enabled),
    [agents]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleInstallToCentral(skillId: string) {
    setImportingIds((prev) => new Set(prev).add(skillId));
    try {
      await importToCentral(skillId);
      await Promise.all([refreshCounts(), refreshDiscoverCounts()]);
      toast.success(t("discover.importSuccess"));
    } catch (err) {
      toast.error(t("discover.importError", { error: String(err) }));
    } finally {
      setImportingIds((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    }
  }

  function handleInstallToPlatform(skill: DiscoveredSkill) {
    setInstallTargetSkill(skill);
    setIsInstallDialogOpen(true);
  }

  async function handleBatchInstallCentral() {
    const ids = Array.from(selectedSkillIds);
    for (const id of ids) {
      await handleInstallToCentral(id);
    }
  }

  async function handleInstallFromDialog(
    _skillId: string,
    agentIds: string[],
    _method: string
  ) {
    if (!installTargetSkill) return;
    setImportingIds((prev) => new Set(prev).add(installTargetSkill!.id));
    try {
      for (const agentId of agentIds) {
        await importToPlatform(installTargetSkill!.id, agentId);
      }
      await Promise.all([refreshCounts(), refreshDiscoverCounts()]);
      toast.success(t("discover.importSuccess"));
    } catch (err) {
      toast.error(t("discover.importError", { error: String(err) }));
    } finally {
      setImportingIds((prev) => {
        const next = new Set(prev);
        next.delete(installTargetSkill!.id);
        return next;
      });
      setIsInstallDialogOpen(false);
      setInstallTargetSkill(null);
    }
  }

  async function handleRescan() {
    await loadScanRoots();
    setIsConfigOpen(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Scanning or empty — full-width content
  if (isScanning) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-xl font-semibold">{t("discover.resultsTitle")}</h1>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <ProgressView />
        </div>
        <DiscoverConfigDialog open={isConfigOpen} onOpenChange={setIsConfigOpen} />
      </div>
    );
  }

  if (discoveredProjects.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t("discover.resultsTitle")}</h1>
          <Button variant="outline" size="sm" onClick={handleRescan}>
            <RefreshCw className="size-3.5 mr-1" />
            {t("discover.reScan")}
          </Button>
        </div>
        <div className="flex-1">
          <EmptyState />
        </div>
        <DiscoverConfigDialog open={isConfigOpen} onOpenChange={setIsConfigOpen} />
      </div>
    );
  }

  // ── Master-Detail Layout ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("discover.resultsTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("discover.foundSummary", {
              skills: totalSkillsFound,
              projects: discoveredProjects.length,
            })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRescan}>
          <RefreshCw className="size-3.5 mr-1" />
          {t("discover.reScan")}
        </Button>
      </div>

      {/* Master-Detail body */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left Panel: Project List (240px) ─────────────────────────────── */}
        <div className="w-60 shrink-0 border-r border-border flex flex-col">
          {/* Project search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={t("discover.searchPlaceholder")}
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-7 h-7 text-xs bg-muted/40"
              />
            </div>
          </div>

          {/* Project list */}
          <div className="flex-1 overflow-y-auto py-1">
            {filteredProjectList.map((project) => {
              const encoded = encodeURIComponent(project.project_path);
              const isActive = projectPath === project.project_path;
              return (
                <button
                  key={project.project_path}
                  onClick={() => {
                    navigate(`/discover/${encoded}`);
                    setSkillSearch("");
                  }}
                  title={project.project_path}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-left transition-colors cursor-pointer border-l-2 rounded-md",
                    isActive
                      ? "bg-primary/15 border-primary text-foreground font-medium"
                      : "hover:bg-muted/40 border-transparent text-muted-foreground"
                  )}
                >
                  <Folder className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm truncate flex-1">{project.project_name}</span>
                  <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
                    {project.skills.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right Panel: Skills for selected project ─────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedProject ? (
            <>
              {/* Project header + skill search */}
              <div className="px-6 py-3 border-b border-border flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold truncate">{selectedProject.project_name}</h2>
                  <p className="text-xs text-muted-foreground truncate">{selectedProject.project_path}</p>
                </div>
                <div className="relative w-48 shrink-0">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={t("discover.searchPlaceholder")}
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    className="pl-7 h-7 text-xs bg-muted/40"
                  />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {t("collection.skills", { count: displayedSkills.length })}
                </span>
              </div>

              {/* Skill cards */}
              <div className="flex-1 overflow-auto p-4 space-y-2">
                {displayedSkills.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                    <Radar className="size-8 text-muted-foreground opacity-40" />
                    <p className="text-sm text-muted-foreground">
                      {skillSearch.trim()
                        ? t("discover.noMatch", { query: skillSearch })
                        : t("discover.noResults")}
                    </p>
                  </div>
                ) : (
                  displayedSkills.map((skill) => (
                    <UnifiedSkillCard
                      key={skill.id}
                      name={skill.name}
                      description={skill.description}
                      checkbox={{
                        checked: selectedSkillIds.has(skill.id),
                        onChange: () => toggleSkillSelection(skill.id),
                      }}
                      isCentral={skill.is_already_central}
                      platformBadge={{ id: skill.platform_id, name: skill.platform_name }}
                      projectBadge={skill.project_name}
                      onDetail={skill.is_already_central ? () => navigate(`/skill/${skill.id}`) : undefined}
                      onInstallToCentral={() => handleInstallToCentral(skill.id)}
                      onInstallToPlatform={() => handleInstallToPlatform(skill)}
                      isLoading={importingIds.has(skill.id)}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <Radar className="size-5 mr-2 opacity-40" />
              {t("discover.noResults")}
            </div>
          )}
        </div>
      </div>

      {/* Selection action bar */}
      {selectedSkillIds.size > 0 && (
        <div className="border-t border-border px-6 py-3 flex items-center gap-3 bg-muted/20">
          <span className="text-sm text-muted-foreground">
            {t("discover.selected", { count: selectedSkillIds.size })}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchInstallCentral}
            >
              <ArrowUpRight className="size-3.5 mr-1" />
              {t("discover.installSelectedCentral")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
            >
              {t("discover.deselectAll")}
            </Button>
          </div>
        </div>
      )}

      {/* Config Dialog */}
      <DiscoverConfigDialog
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
      />

      {/* Install Dialog */}
      {installTargetSkill && (
        <InstallDialog
          open={isInstallDialogOpen}
          onOpenChange={(open) => {
            setIsInstallDialogOpen(open);
            if (!open) setInstallTargetSkill(null);
          }}
          skill={{
            id: installTargetSkill.id,
            name: installTargetSkill.name,
            description: installTargetSkill.description,
            file_path: installTargetSkill.file_path,
            is_central: false,
            linked_agents: [],
            scanned_at: new Date().toISOString(),
          } as SkillWithLinks}
          agents={platformAgents}
          onInstall={handleInstallFromDialog}
        />
      )}
    </div>
  );
}
