import { useState, useEffect } from "react";
import { Link2, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LinkGitHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLink: (repoUrl: string, sourcePath?: string, branch?: string) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidGitHubUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== "github.com") return false;
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0;
  } catch {
    return false;
  }
}

// ─── LinkGitHubDialog ─────────────────────────────────────────────────────────

export function LinkGitHubDialog({
  open,
  onOpenChange,
  onLink,
}: LinkGitHubDialogProps) {
  const { t } = useTranslation();
  const [repoUrl, setRepoUrl] = useState("");
  const [sourcePath, setSourcePath] = useState("");
  const [branch, setBranch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens.
  useEffect(() => {
    if (open) {
      setRepoUrl("");
      setSourcePath("");
      setBranch("");
      setValidationError(null);
      setError(null);
    }
  }, [open]);

  async function handleSubmit() {
    const trimmedUrl = repoUrl.trim();
    if (!trimmedUrl || !isValidGitHubUrl(trimmedUrl)) {
      setValidationError(t("marketplace.invalidRepoUrl"));
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);
    setError(null);

    try {
      await onLink(
        trimmedUrl,
        sourcePath.trim() || undefined,
        branch.trim() || undefined
      );
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !isSubmitting) {
      handleSubmit();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("detail.linkToGitHubTitle")}</DialogTitle>
          <DialogDescription>
            {t("detail.noGitHubSource")}
          </DialogDescription>
          <DialogClose />
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {t("detail.repoUrl")}
            </label>
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://github.com/owner/repo"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {t("detail.pathInRepo")}
            </label>
            <Input
              value={sourcePath}
              onChange={(e) => setSourcePath(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="skills/my-skill"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {t("detail.branch")}
            </label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="main"
              disabled={isSubmitting}
            />
          </div>

          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            ) : (
              <Link2 className="size-4 mr-1.5" />
            )}
            {t("detail.link")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
