import { useEffect, useRef, useState } from "react";
import {
  Plus,
  FileInput,
  Layers,
  Loader2,
  BookOpen,
  Pencil,
  Trash2,
  Download,
  PackagePlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useCollectionStore } from "@/stores/collectionStore";
import { usePlatformStore } from "@/stores/platformStore";
import { useCentralSkillsStore } from "@/stores/centralSkillsStore";
import { CollectionEditor } from "@/components/collection/CollectionEditor";
import { SkillPickerDialog } from "@/components/collection/SkillPickerDialog";
import { CollectionInstallDialog } from "@/components/collection/CollectionInstallDialog";
import { InstallDialog } from "@/components/central/InstallDialog";
import { UnifiedSkillCard } from "@/components/skill/UnifiedSkillCard";
import { Collection, SkillWithLinks } from "@/types";
import { cn } from "@/lib/utils";

// ─── CollectionsListView ─────────────────────────────────────────────────────

export function CollectionsListView() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Collection store
  const collections = useCollectionStore((s) => s.collections);
  const isLoading = useCollectionStore((s) => s.isLoading);
  const loadCollections = useCollectionStore((s) => s.loadCollections);
  const importCollection = useCollectionStore((s) => s.importCollection);
  const currentDetail = useCollectionStore((s) => s.currentDetail);
  const isLoadingDetail = useCollectionStore((s) => s.isLoadingDetail);
  const loadCollectionDetail = useCollectionStore((s) => s.loadCollectionDetail);
  const removeSkillFromCollection = useCollectionStore((s) => s.removeSkillFromCollection);
  const deleteCollection = useCollectionStore((s) => s.deleteCollection);
  const batchInstallCollection = useCollectionStore((s) => s.batchInstallCollection);
  const exportCollection = useCollectionStore((s) => s.exportCollection);
  const addSkillToCollection = useCollectionStore((s) => s.addSkillToCollection);

  const agents = usePlatformStore((s) => s.agents);
  const refreshCounts = usePlatformStore((s) => s.refreshCounts);

  // Central skills (for resolving SkillWithLinks before opening InstallDialog)
  const centralSkills = useCentralSkillsStore((s) => s.skills);
  const centralAgents = useCentralSkillsStore((s) => s.agents);
  const loadCentralSkills = useCentralSkillsStore((s) => s.loadCentralSkills);
  const installCentralSkill = useCentralSkillsStore((s) => s.installSkill);

  // Local state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [installTargetSkill, setInstallTargetSkill] = useState<SkillWithLinks | null>(null);
  const [isSingleInstallOpen, setIsSingleInstallOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Load collections on mount.
  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Auto-select first collection when none is selected.
  useEffect(() => {
    if (!selectedId && collections.length > 0) {
      setSelectedId(collections[0].id);
    }
  }, [selectedId, collections]);

  // Load detail when selection changes.
  useEffect(() => {
    if (selectedId) {
      loadCollectionDetail(selectedId);
    }
  }, [selectedId, loadCollectionDetail]);

  // Ensure central skills are loaded so we can resolve SkillWithLinks for InstallDialog.
  useEffect(() => {
    if (centralSkills.length === 0) {
      loadCentralSkills();
    }
  }, [centralSkills.length, loadCentralSkills]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSelect(id: string) {
    setSelectedId(id);
  }

  function handleInstallSingleSkillClick(skillId: string) {
    const target = centralSkills.find((s) => s.id === skillId);
    if (!target) {
      toast.error(t("central.installError", { error: t("platform.notFound") }));
      return;
    }
    setInstallTargetSkill(target);
    setIsSingleInstallOpen(true);
  }

  async function handleInstallSingleSkill(skillId: string, agentIds: string[], method: string) {
    try {
      const result = await installCentralSkill(skillId, agentIds, method);
      await refreshCounts();
      if (result.failed.length > 0) {
        const failedNames = result.failed.map((f) => f.agent_id).join(", ");
        toast.error(t("central.installPartialFail", { platforms: failedNames }));
      }
    } catch (err) {
      toast.error(t("central.installError", { error: String(err) }));
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const collection = await importCollection(text);
      setSelectedId(collection.id);
    } catch (err) {
      toast.error(String(err));
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function handleRemoveSkill(skillId: string) {
    if (!selectedId) return;
    try {
      await removeSkillFromCollection(selectedId, skillId);
    } catch (err) {
      toast.error(t("collection.removeSkillError", { error: String(err) }));
    }
  }

  async function handleDelete() {
    if (!selectedId || !currentDetail) return;
    if (!window.confirm(t("collection.deleteConfirm", { name: currentDetail.name }))) return;
    setIsDeleting(true);
    try {
      await deleteCollection(selectedId);
      setSelectedId(null);
    } catch (err) {
      toast.error(t("collection.deleteError", { error: String(err) }));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleExport() {
    if (!selectedId || !currentDetail) return;
    try {
      const json = await exportCollection(selectedId);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentDetail.name.replace(/\s+/g, "-").toLowerCase()}-collection.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(t("collection.exportError", { error: String(err) }));
    }
  }

  async function handleAddSkills(skillIds: string[]) {
    if (!selectedId) return;
    try {
      for (const skillId of skillIds) {
        await addSkillToCollection(selectedId, skillId);
      }
    } catch (err) {
      toast.error(t("collection.addSkillError", { error: String(err) }));
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">{t("sidebar.collections")}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
            >
              <FileInput className="size-3.5" />
              <span>{t("sidebar.importCollection")}</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsEditorOpen(true)}
            >
              <Plus className="size-3.5" />
              <span>{t("sidebar.newCollectionLabel")}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
            <div className="p-4 rounded-full bg-muted/60">
              <Layers className="size-12 text-muted-foreground opacity-60" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {t("collectionPicker.noCollections")}
            </p>
            <Button variant="default" size="sm" onClick={() => setIsEditorOpen(true)}>
              <Plus className="size-3.5" />
              {t("sidebar.newCollectionLabel")}
            </Button>
          </div>
        ) : (
          <>
            {/* Collection cards — horizontal row */}
            <div className="flex items-center gap-2 px-6 py-4 border-b border-border overflow-x-auto">
              {collections.map((col) => (
                <CollectionChip
                  key={col.id}
                  collection={col}
                  isActive={selectedId === col.id}
                  onClick={() => handleSelect(col.id)}
                />
              ))}
            </div>

            {/* Selected collection detail */}
            {selectedId && currentDetail && currentDetail.id === selectedId ? (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Detail header */}
                <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold truncate">{currentDetail.name}</h2>
                    {currentDetail.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {currentDetail.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                      <Pencil className="size-3.5" />
                      <span>{t("collection.edit")}</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                      <Download className="size-3.5" />
                      <span>{t("collection.export")}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                    >
                      {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      <span>{t("collection.delete")}</span>
                    </Button>
                  </div>
                </div>

                {/* Skills sub-header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-border">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("collection.skills", { count: currentDetail.skills.length })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsInstallOpen(true)}
                      disabled={currentDetail.skills.length === 0}
                    >
                      <PackagePlus className="size-3.5" />
                      <span>{t("collection.batchInstall")}</span>
                    </Button>
                    <Button variant="default" size="sm" onClick={() => setIsPickerOpen(true)}>
                      <Plus className="size-3.5" />
                      <span>{t("collection.addSkill")}</span>
                    </Button>
                  </div>
                </div>

                {/* Skills list */}
                <div className="flex-1 overflow-auto">
                  {currentDetail.skills.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                      <div className="p-4 rounded-full bg-muted/60">
                        <BookOpen className="size-12 text-muted-foreground opacity-60" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">{t("collection.noSkillsTitle")}</p>
                      <p className="text-xs text-muted-foreground/70">{t("collection.noSkillsDesc")}</p>
                      <Button variant="default" size="sm" onClick={() => setIsPickerOpen(true)}>
                        <Plus className="size-3.5" />
                        {t("collection.addFirstSkill")}
                      </Button>
                    </div>
                  ) : (
                    <div className="mx-6 my-3 grid grid-cols-2 gap-4">
                      {currentDetail.skills.map((skill) => (
                        <UnifiedSkillCard
                          key={skill.id}
                          name={skill.name}
                          description={skill.description}
                          onDetail={() => navigate(`/skill/${skill.id}`)}
                          onInstallTo={() => handleInstallSingleSkillClick(skill.id)}
                          onRemove={() => handleRemoveSkill(skill.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : isLoadingDetail ? (
              <div className="flex items-center justify-center flex-1 gap-3 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">{t("collection.loading")}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Dialogs */}
      <CollectionEditor open={isEditorOpen} onOpenChange={setIsEditorOpen} collection={null} />

      {currentDetail && (
        <>
          <CollectionEditor open={isEditOpen} onOpenChange={setIsEditOpen} collection={{
            id: currentDetail.id,
            name: currentDetail.name,
            description: currentDetail.description,
            created_at: currentDetail.created_at,
            updated_at: currentDetail.updated_at,
          }} />
          <SkillPickerDialog
            open={isPickerOpen}
            onOpenChange={setIsPickerOpen}
            existingSkillIds={currentDetail.skills.map((s) => s.id)}
            onAdd={handleAddSkills}
          />
          <CollectionInstallDialog
            open={isInstallOpen}
            onOpenChange={setIsInstallOpen}
            collectionName={currentDetail.name}
            skillCount={currentDetail.skills.length}
            agents={agents}
            onInstall={(agentIds) => batchInstallCollection(currentDetail.id, agentIds)}
          />
        </>
      )}

      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      <InstallDialog
        open={isSingleInstallOpen}
        onOpenChange={setIsSingleInstallOpen}
        skill={installTargetSkill}
        agents={centralAgents}
        onInstall={handleInstallSingleSkill}
      />
    </div>
  );
}

// ─── CollectionChip ──────────────────────────────────────────────────────────

function CollectionChip({
  collection,
  isActive,
  onClick,
}: {
  collection: Collection;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-md border transition-colors cursor-pointer shrink-0",
        isActive
          ? "bg-primary/15 border-primary text-foreground font-medium"
          : "border-border hover:border-primary/40 hover:bg-hover-bg/10 text-muted-foreground"
      )}
    >
      <Layers className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} />
      <span className="text-sm truncate max-w-[160px]">{collection.name}</span>
    </button>
  );
}
