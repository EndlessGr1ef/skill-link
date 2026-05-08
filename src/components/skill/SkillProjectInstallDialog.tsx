import { useState, useMemo } from "react";
import { FolderOpen, Loader2, Eye, EyeOff, FolderInput, FolderSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { PlatformIcon } from "@/components/platform/PlatformIcon";
import { AgentWithStatus, DiscoveredProject, SkillInstallation } from "@/types";
import { useLocalStorageToggle } from "@/hooks/useLocalStorageToggle";
import {
  LEGACY_SHOW_ALL_PLATFORMS_STORAGE_KEYS,
  SHOW_ALL_PLATFORMS_STORAGE_KEY,
} from "@/lib/platformVisibility";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillProjectInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillId: string;
  skillName: string;
  agents: AgentWithStatus[];
  discoveredProjects: DiscoveredProject[];
  existingInstallations: SkillInstallation[];
  onInstallToProject: (skillId: string, agentIds: string[], projectPath: string) => Promise<void>;
  onInstallToCustomPath: (skillId: string, targetDir: string, method?: string) => Promise<void>;
}

type InstallTab = "agent" | "custom";

// ─── SkillProjectInstallDialog ──────────────────────────────────────────────────

export function SkillProjectInstallDialog({
  open,
  onOpenChange,
  skillId,
  skillName,
  agents,
  discoveredProjects,
  existingInstallations,
  onInstallToProject,
  onInstallToCustomPath,
}: SkillProjectInstallDialogProps) {
  const { t } = useTranslation();

  // Tab state
  const [activeTab, setActiveTab] = useState<InstallTab>("custom");

  // ── Agent tab state ──
  const projectCapableAgents = agents.filter(
    (a) => a.id !== "central" && a.category !== "lobster" && a.project_skills_dir,
  );

  const detectedAgentIds = useMemo(
    () => new Set(projectCapableAgents.filter((a) => a.is_detected).map((a) => a.id)),
    [projectCapableAgents],
  );

  const [showAllPlatforms, toggleShowAllPlatforms] = useLocalStorageToggle(
    SHOW_ALL_PLATFORMS_STORAGE_KEY,
    false,
    LEGACY_SHOW_ALL_PLATFORMS_STORAGE_KEYS,
  );

  const filteredAgents = useMemo(() => {
    if (showAllPlatforms || detectedAgentIds.size === 0) return projectCapableAgents;
    return projectCapableAgents.filter((a) => detectedAgentIds.has(a.id));
  }, [showAllPlatforms, projectCapableAgents, detectedAgentIds]);

  const [selectedProjectPath, setSelectedProjectPath] = useState<string>("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());

  // ── Custom path tab state ──
  const [customTargetDir, setCustomTargetDir] = useState<string>("");
  const [installMethod, setInstallMethod] = useState<"symlink" | "copy">("symlink");

  // ── Common state ──
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Existing project installs for this skill (project_path -> agent_ids)
  const projectInstallMap = new Map<string, string[]>();
  for (const inst of existingInstallations) {
    if (inst.project_path && inst.skill_id === skillId) {
      const list = projectInstallMap.get(inst.project_path) ?? [];
      list.push(inst.agent_id);
      projectInstallMap.set(inst.project_path, list);
    }
  }

  // Reset state when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedProjectPath("");
      setSelectedAgentIds(new Set(detectedAgentIds));
      setCustomTargetDir("");
      setInstallMethod("symlink");
      setActiveTab("custom");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  async function handlePickFolder() {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: t("detail.selectTargetDirectory"),
      });
      if (selected) {
        setCustomTargetDir(selected);
      }
    } catch {
      // User cancelled or dialog error — ignore
    }
  }

  function handleAgentToggle(agentId: string, checked: boolean) {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(agentId);
      else next.delete(agentId);
      return next;
    });
  }

  async function handleConfirm() {
    if (!skillId) return;
    setIsInstalling(true);
    setError(null);
    try {
      if (activeTab === "agent") {
        if (!selectedProjectPath || selectedAgentIds.size === 0) return;
        await onInstallToProject(skillId, Array.from(selectedAgentIds), selectedProjectPath);
      } else {
        if (!customTargetDir.trim()) return;
        await onInstallToCustomPath(skillId, customTargetDir.trim(), installMethod);
      }
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsInstalling(false);
    }
  }

  const canInstall =
    activeTab === "agent"
      ? selectedProjectPath !== "" && selectedAgentIds.size > 0
      : customTargetDir.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("detail.installToProject")}</DialogTitle>
          <DialogDescription>
            {t("platform.installToProjectLabel", {
              skill: skillName,
              platform: "",
              defaultValue: `Install "${skillName}" to a project`,
            })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Tab switcher */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer",
                activeTab === "custom"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <FolderInput className="size-3.5" />
              {t("detail.customPath")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("agent")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer",
                activeTab === "agent"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <FolderOpen className="size-3.5" />
              {t("detail.byAgent")}
            </button>
          </div>

          {/* ── Custom Path Tab ── */}
          {activeTab === "custom" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  {t("detail.targetDirectory")}
                </label>
                {customTargetDir.trim() ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                    <FolderInput className="size-4 text-primary shrink-0" />
                    <span className="font-mono text-sm text-foreground truncate flex-1" title={customTargetDir.trim()}>
                      {customTargetDir.trim()}
                    </span>
                    <button
                      type="button"
                      onClick={handlePickFolder}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer shrink-0"
                    >
                      {t("detail.changeDirectory")}
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handlePickFolder}
                    className="w-full gap-2 h-20"
                  >
                    <FolderSearch className="size-5 text-muted-foreground" />
                    <span className="text-sm">{t("detail.browseDirectory")}</span>
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {t("detail.customPathDesc")}
                </p>
              </div>

              {/* Install method selector */}
              {customTargetDir.trim() && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("installDialog.installMethod")}
                  </p>
                  <RadioGroup
                    value={installMethod}
                    onValueChange={(v) => setInstallMethod(v as "symlink" | "copy")}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <RadioItem value="symlink" />
                      <span className="text-sm">{t("installDialog.symlink")}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("installDialog.symlinkDesc")}
                      </span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <RadioItem value="copy" />
                      <span className="text-sm">{t("installDialog.copy")}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("installDialog.copyDesc")}
                      </span>
                    </label>
                  </RadioGroup>
                </div>
              )}

              {customTargetDir.trim() && (
                <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
                  <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">
                    {installMethod === "symlink" ? "Symlink" : "Copy"}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground break-all leading-relaxed">
                    {customTargetDir.trim()}/{skillId}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── By Agent Tab ── */}
          {activeTab === "agent" && (
            <>
              {/* Project picker */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  {t("platform.selectProject")}
                </label>
                {discoveredProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">
                    {t("platform.noProjectInstallations")}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {discoveredProjects.map((project) => {
                      const isSelected = selectedProjectPath === project.project_path;
                      return (
                        <button
                          key={project.project_path}
                          type="button"
                          onClick={() => setSelectedProjectPath(project.project_path)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                            isSelected
                              ? "bg-primary/15 ring-1 ring-primary/30"
                              : "hover:bg-muted/40",
                          )}
                        >
                          <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {project.project_name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {project.project_path}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Agent checkboxes — only shown after selecting a project */}
              {selectedProjectPath && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                    {t("installDialog.choosePlatforms")}
                  </label>
                  {filteredAgents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("installDialog.noPlatforms")}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {filteredAgents.map((agent) => {
                        const existingAgents = projectInstallMap.get(selectedProjectPath) ?? [];
                        const isAlreadyInstalled = existingAgents.includes(agent.id);
                        const isChecked = selectedAgentIds.has(agent.id);

                        return (
                          <div key={agent.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) =>
                                handleAgentToggle(agent.id, !!checked)
                              }
                              aria-label={agent.display_name}
                            />
                            <PlatformIcon agentId={agent.id} className="size-3.5 shrink-0" />
                            <span
                              className="text-sm text-foreground flex-1 cursor-pointer select-none truncate"
                              onClick={() => handleAgentToggle(agent.id, !isChecked)}
                            >
                              {agent.display_name}
                            </span>
                            {isAlreadyInstalled && (
                              <span className="text-xs text-primary shrink-0">
                                {t("installDialog.alreadyLinked")}
                              </span>
                            )}
                            {!agent.is_detected && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {t("installDialog.notDetected")}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {detectedAgentIds.size > 0 && (
                    <button
                      type="button"
                      onClick={toggleShowAllPlatforms}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer rounded-md px-2 py-1",
                        showAllPlatforms
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                      )}
                    >
                      {showAllPlatforms ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                      {showAllPlatforms
                        ? t("sidebar.hideEmptyPlatforms")
                        : t("sidebar.showAllPlatforms")}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <DialogClose>
            <Button variant="outline" size="sm" disabled={isInstalling}>
              {t("installDialog.cancel")}
            </Button>
          </DialogClose>
          <Button size="sm" disabled={!canInstall || isInstalling} onClick={handleConfirm}>
            {isInstalling ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t("installDialog.installing")}
              </>
            ) : (
              t("detail.installToProject")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
