import { useState } from "react";
import { FolderOpen, Package } from "lucide-react";
import { useTranslation } from "react-i18next";

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
import { DiscoveredProject, SkillInstallation, SkillWithLinks } from "@/types";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected skill ID (empty = show skill picker). */
  skillId: string;
  /** Pre-selected skill name (empty = show skill picker). */
  skillName: string;
  agentId: string;
  agentName: string;
  centralSkills: SkillWithLinks[];
  discoveredProjects: DiscoveredProject[];
  existingInstallations: SkillInstallation[];
  onInstall: (skillId: string, agentId: string, projectPath: string) => Promise<void>;
}

// ─── ProjectInstallDialog ──────────────────────────────────────────────────────

export function ProjectInstallDialog({
  open,
  onOpenChange,
  skillId: preselectedSkillId,
  skillName: preselectedSkillName,
  agentId,
  agentName,
  centralSkills,
  discoveredProjects,
  existingInstallations,
  onInstall,
}: ProjectInstallDialogProps) {
  const { t } = useTranslation();
  const [selectedSkillId, setSelectedSkillId] = useState(preselectedSkillId);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [isInstalling, setIsInstalling] = useState(false);

  // When a preselected skill is provided, use it directly.
  const hasPreselectedSkill = preselectedSkillId !== "";
  const effectiveSkillId = hasPreselectedSkill ? preselectedSkillId : selectedSkillId;
  const effectiveSkillName = hasPreselectedSkill
    ? preselectedSkillName
    : centralSkills.find((s) => s.id === selectedSkillId)?.name ?? selectedSkillId;

  // Projects that already have this skill installed for this agent.
  const installedPaths = new Set(
    existingInstallations
      .filter((i) => i.skill_id === effectiveSkillId && i.agent_id === agentId)
      .map((i) => i.project_path),
  );

  // Filter to projects not already having this skill.
  const availableProjects = discoveredProjects.filter(
    (p) => !installedPaths.has(p.project_path),
  );

  // Skills available for project install (central skills not already installed everywhere).
  const availableSkills = centralSkills.filter(
    (s) => s.id !== "central",
  );

  async function handleInstall() {
    if (!effectiveSkillId || !selectedPath) return;
    setIsInstalling(true);
    try {
      await onInstall(effectiveSkillId, agentId, selectedPath);
      onOpenChange(false);
      setSelectedSkillId("");
      setSelectedPath("");
    } finally {
      setIsInstalling(false);
    }
  }

  const canInstall = effectiveSkillId !== "" && selectedPath !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("platform.installToProject")}
          </DialogTitle>
          <DialogDescription>
            {t("platform.installToProjectLabel", {
              skill: effectiveSkillName || "...",
              platform: agentName,
            })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Skill picker — only shown when no skill is preselected */}
          {!hasPreselectedSkill && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                {t("central.title", { defaultValue: "Central Skills" })}
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {availableSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => setSelectedSkillId(skill.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                      selectedSkillId === skill.id
                        ? "bg-primary/15 ring-1 ring-primary/30"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <Package className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{skill.name}</div>
                      {skill.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {skill.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Project picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
              {t("platform.selectProject")}
            </label>
            {availableProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("platform.noProjectInstallations")}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {availableProjects.map((project) => (
                  <button
                    key={project.project_path}
                    type="button"
                    onClick={() => setSelectedPath(project.project_path)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      selectedPath === project.project_path
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
                ))}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose>
            <Button variant="outline" size="sm">
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={!canInstall || isInstalling}
            onClick={handleInstall}
          >
            {isInstalling
              ? t("common.installing", { defaultValue: "Installing..." })
              : t("platform.installToProject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
