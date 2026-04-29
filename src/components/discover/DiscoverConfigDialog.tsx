import { useState } from "react";
import { Radar, Loader2, AlertTriangle, Plus, X, Tag, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useDiscoverStore } from "@/stores/discoverStore";
import { usePlatformStore } from "@/stores/platformStore";
import { ScanRoot } from "@/types";
import { describeSkillsPattern } from "@/lib/path";

// ─── DiscoverConfigDialog ────────────────────────────────────────────────────

interface DiscoverConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscoverConfigDialog({ open, onOpenChange }: DiscoverConfigDialogProps) {
  const { t } = useTranslation();

  const scanRoots = useDiscoverStore((s) => s.scanRoots);
  const isLoadingRoots = useDiscoverStore((s) => s.isLoadingRoots);
  const loadScanRoots = useDiscoverStore((s) => s.loadScanRoots);
  const setScanRootEnabled = useDiscoverStore((s) => s.setScanRootEnabled);
  const addCustomScanRoot = useDiscoverStore((s) => s.addCustomScanRoot);
  const removeCustomScanRoot = useDiscoverStore((s) => s.removeCustomScanRoot);
  const startScan = useDiscoverStore((s) => s.startScan);

  const agents = usePlatformStore((s) => s.agents);

  // State for "Add directory" inline form.
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Load roots when dialog opens.
  const handleOpenChange = (open: boolean) => {
    if (open) {
      loadScanRoots();
      setShowAddForm(false);
      setSelectedPath("");
      setNewLabel("");
    }
    onOpenChange(open);
  };

  // Get platform skill directory patterns for display.
  const platformPatterns = agents
    .filter((a) => a.id !== "central" && a.is_enabled)
    .map((a) => ({
      name: a.display_name,
      pattern: describeSkillsPattern(a.global_skills_dir),
    }));

  const enabledCount = scanRoots.filter((r) => r.enabled && r.exists).length;

  function handleStartScan() {
    onOpenChange(false);
    startScan();
  }

  async function handlePickFolder() {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: t("discover.addCustomRoot"),
      });
      if (selected) {
        setSelectedPath(selected);
        // Auto-fill label from directory name if not yet customized.
        if (!newLabel.trim()) {
          const parts = selected.replace(/\/$/, "").split("/");
          setNewLabel(parts[parts.length - 1] || "");
        }
      }
    } catch {
      // User cancelled the dialog — do nothing.
    }
  }

  async function handleAddRoot() {
    if (!selectedPath) {
      toast.error(t("discover.pathRequired"));
      return;
    }
    setIsAdding(true);
    try {
      await addCustomScanRoot(selectedPath, newLabel.trim() || undefined);
      toast.success(t("discover.addRootSuccess"));
      setSelectedPath("");
      setNewLabel("");
      setShowAddForm(false);
    } catch (err) {
      toast.error(t("discover.addRootError", { error: String(err) }));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveRoot(path: string) {
    try {
      await removeCustomScanRoot(path);
      toast.success(t("discover.removeRootSuccess"));
    } catch (err) {
      toast.error(t("discover.removeRootError", { error: String(err) }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="size-5" />
            {t("discover.title")}
          </DialogTitle>
          <DialogDescription>{t("discover.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scan Roots */}
          <div>
            <h3 className="text-sm font-medium mb-2">{t("discover.scanRoots")}</h3>
            <p className="text-xs text-muted-foreground mb-2">
              {t("discover.scanRootsDesc")}
            </p>

            {isLoadingRoots ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                <Loader2 className="size-4 animate-spin" />
                <span>{t("common.loading")}</span>
              </div>
            ) : scanRoots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">
                No candidate directories found.
              </p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {scanRoots.map((root) => (
                  <ScanRootRow
                    key={root.path}
                    root={root}
                    onToggle={(enabled) =>
                      setScanRootEnabled(root.path, enabled)
                    }
                    onRemove={
                      root.is_custom
                        ? () => handleRemoveRoot(root.path)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}

            {/* Add directory button / inline form */}
            <div className="mt-2">
              {showAddForm ? (
                <div className="space-y-2 p-2.5 rounded-lg border border-border bg-muted/20">
                  {/* Folder picker row */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs shrink-0"
                      onClick={handlePickFolder}
                    >
                      <FolderOpen className="size-3.5 mr-1" />
                      {t("discover.browseFolder")}
                    </Button>
                    <span
                      className={`text-xs font-mono truncate flex-1 min-w-0 ${selectedPath ? "text-foreground" : "text-muted-foreground"}`}
                      title={selectedPath || undefined}
                    >
                      {selectedPath || t("discover.noFolderSelected")}
                    </span>
                  </div>

                  {/* Label input */}
                  <Input
                    placeholder={t("discover.customRootLabelPlaceholder")}
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && selectedPath) handleAddRoot();
                      if (e.key === "Escape") setShowAddForm(false);
                    }}
                  />

                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setShowAddForm(false);
                        setSelectedPath("");
                        setNewLabel("");
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleAddRoot}
                      disabled={isAdding || !selectedPath}
                    >
                      {isAdding ? (
                        <Loader2 className="size-3 mr-1 animate-spin" />
                      ) : (
                        <Plus className="size-3 mr-1" />
                      )}
                      {t("discover.addCustomRoot")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs w-full"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="size-3 mr-1" />
                  {t("discover.addCustomRoot")}
                </Button>
              )}
            </div>
          </div>

          {/* Platform Patterns */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-1">
              {t("discover.lookingFor")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {platformPatterns.slice(0, 6).map((p) => (
                <span
                  key={p.name}
                  className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                >
                  {p.pattern}
                </span>
              ))}
              {platformPatterns.length > 6 && (
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  +{platformPatterns.length - 6}
                </span>
              )}
            </div>
          </div>

          {/* Warning if no roots enabled */}
          {enabledCount === 0 && !isLoadingRoots && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-md p-2.5">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{t("discover.noRootsEnabled")}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleStartScan}
            disabled={enabledCount === 0}
          >
            <Radar className="size-4 mr-1" />
            {t("discover.startScan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ScanRootRow ──────────────────────────────────────────────────────────────

function ScanRootRow({
  root,
  onToggle,
  onRemove,
}: {
  root: ScanRoot;
  onToggle: (enabled: boolean) => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-hover-bg/20 cursor-pointer group">
      <Checkbox
        checked={root.enabled}
        onCheckedChange={(checked) => onToggle(!!checked)}
        disabled={!root.exists}
        aria-label={root.path}
      />
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm font-mono truncate block ${!root.exists ? "text-muted-foreground line-through" : ""}`}
          title={root.path}
        >
          {root.path}
        </span>
      </div>
      {root.is_custom && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0 inline-flex items-center gap-0.5">
          <Tag className="size-2.5" />
          {root.label}
        </span>
      )}
      {!root.is_custom && (
        <span className="text-xs text-muted-foreground shrink-0">
          {root.label}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive shrink-0 cursor-pointer"
          title={t("discover.removeCustomRoot")}
          aria-label={t("discover.removeCustomRoot")}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
