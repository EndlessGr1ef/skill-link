import { useEffect, useMemo, useRef, useState } from "react";
import { Search, RefreshCw, Blocks, FolderOpen, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { useCentralSkillsStore } from "@/stores/centralSkillsStore";
import { usePlatformStore } from "@/stores/platformStore";
import { UnifiedSkillCard } from "@/components/skill/UnifiedSkillCard";
import { InstallDialog } from "@/components/central/InstallDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { consumeScrollPosition, createScrollRestorationState } from "@/lib/scrollRestoration";
import { SkillWithLinks } from "@/types";

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
      <div className="p-4 rounded-full bg-muted/60">
        <Blocks className="size-12 text-muted-foreground opacity-60" />
      </div>
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </div>
  );
}

// ─── First Visit Empty State ──────────────────────────────────────────────────

function FirstVisitEmptyState() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 py-16 text-center px-8">
      <div className="p-5 rounded-full bg-primary/10 ring-1 ring-primary/20">
        <Blocks className="size-14 text-primary opacity-70" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">{t("empty.welcomeTitle")}</h2>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          {t("empty.welcomeDesc")}
        </p>
      </div>
      <div className="flex flex-col gap-3 items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-4 py-3 max-w-xs text-left border border-border">
          <FolderOpen className="size-4 shrink-0 text-primary/60" />
          <span>
            {t("empty.createHint")} <code className="font-mono">~/.agents/skills/my-skill/SKILL.md</code>
          </span>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => navigate("/settings")}
          className="gap-2"
        >
          <Settings className="size-4" />
          {t("empty.goToSettings")}
        </Button>
      </div>
    </div>
  );
}

// ─── CentralSkillsView ────────────────────────────────────────────────────────

export function CentralSkillsView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const skills = useCentralSkillsStore((state) => state.skills);
  const agents = useCentralSkillsStore((state) => state.agents);
  const isLoading = useCentralSkillsStore((state) => state.isLoading);
  const loadCentralSkills = useCentralSkillsStore(
    (state) => state.loadCentralSkills
  );
  const installSkill = useCentralSkillsStore((state) => state.installSkill);
  const togglePlatformLink = useCentralSkillsStore((state) => state.togglePlatformLink);
  const togglingAgentId = useCentralSkillsStore((state) => state.togglingAgentId);

  // Keep the platform sidebar counts in sync after install.
  const refreshCounts = usePlatformStore((state) => state.refreshCounts);

  const [searchQuery, setSearchQuery] = useState("");
  const [installTargetSkill, setInstallTargetSkill] =
    useState<SkillWithLinks | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const restorationState = location.state?.scrollRestoration;
  const restorationKey =
    restorationState && restorationState.key === "central"
      ? restorationState.key
      : null;

  // Load central skills on mount.
  useEffect(() => {
    loadCentralSkills();
  }, [loadCentralSkills]);

  // Filter skills by search query.
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const q = searchQuery.toLowerCase();
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(q) ||
        skill.description?.toLowerCase().includes(q)
    );
  }, [skills, searchQuery]);

  useEffect(() => {
    if (!restorationKey || isLoading || skills.length === 0 || !contentRef.current) {
      return;
    }

    const scrollTop = consumeScrollPosition(restorationKey);
    if (scrollTop === null) {
      return;
    }

    contentRef.current.scrollTop = scrollTop;
    navigate(location.pathname, { replace: true, state: null });
  }, [restorationKey, isLoading, skills.length, navigate, location.pathname]);

  function handleInstallClick(skill: SkillWithLinks) {
    setInstallTargetSkill(skill);
    setIsDialogOpen(true);
  }

  async function handleTogglePlatform(skillId: string, agentId: string) {
    try {
      await togglePlatformLink(skillId, agentId);
      await refreshCounts();
    } catch (err) {
      toast.error(t("central.installError", { error: String(err) }));
    }
  }

  async function handleInstall(skillId: string, agentIds: string[], method: string) {
    try {
      const result = await installSkill(skillId, agentIds, method);
      // Refresh sidebar counts after install.
      await refreshCounts();
      if (result.failed.length > 0) {
        const failedNames = result.failed.map((f) => f.agent_id).join(", ");
        toast.error(t("central.installPartialFail", { platforms: failedNames }));
      }
    } catch (err) {
      toast.error(t("central.installError", { error: String(err) }));
    }
  }

  async function handleRefresh() {
    try {
      // Re-scan the filesystem first so new/removed skills are picked up,
      // then reload central skills from the (now-updated) database.
      await refreshCounts();
      await loadCentralSkills();
    } catch (err) {
      toast.error(t("central.refreshError", { error: String(err) }));
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("central.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("central.path")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading}
          aria-label={t("central.refresh")}
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Search bar */}
      <div className="px-6 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("central.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-muted/40"
            aria-label={t("central.searchPlaceholder")}
          />
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <EmptyState message={t("central.loading")} />
        ) : skills.length === 0 ? (
          <FirstVisitEmptyState />
        ) : filteredSkills.length === 0 ? (
          <EmptyState message={t("central.noMatch", { query: searchQuery })} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredSkills.map((skill) => (
              <UnifiedSkillCard
                key={skill.id}
                name={skill.name}
                description={skill.description}
                onDetail={() => {
                  if (contentRef.current) {
                    contentRef.current.dataset.scrollRestoration = "central";
                  }
                  navigate(`/skill/${skill.id}`, {
                    state: {
                      scrollRestoration: createScrollRestorationState(
                        "central",
                        contentRef.current?.scrollTop ?? 0
                      ),
                    },
                  });
                }}
                onInstallTo={() => handleInstallClick(skill)}
                platformIcons={{
                  agents,
                  linkedAgents: skill.linked_agents,
                  skillId: skill.id,
                  onToggle: handleTogglePlatform,
                  togglingAgentId,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Install Dialog */}
      <InstallDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        skill={installTargetSkill}
        agents={agents}
        onInstall={handleInstall}
      />
    </div>
  );
}
