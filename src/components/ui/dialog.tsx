import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

// ─── Root ─────────────────────────────────────────────────────────────────────

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

// ─── Backdrop ─────────────────────────────────────────────────────────────────

function DialogBackdrop({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 transition-opacity",
        "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

// ─── Popup (content container) ────────────────────────────────────────────────

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup>) {
  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border border-border bg-card shadow-lg outline-none",
          "transition-all data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
          "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}
      {...props}
    />
  )
}

// ─── Title ────────────────────────────────────────────────────────────────────

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base font-semibold leading-tight text-foreground", className)}
      {...props}
    />
  )
}

// ─── Description ─────────────────────────────────────────────────────────────

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

// ─── Close ────────────────────────────────────────────────────────────────────

function DialogClose({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  const { t } = useTranslation()
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={cn(
        "rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      <X className="size-4" />
      <span className="sr-only">{t("common.close")}</span>
    </DialogPrimitive.Close>
  )
}

// ─── Body ─────────────────────────────────────────────────────────────────────

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("px-5 py-4", className)}
      {...props}
    />
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex items-center justify-end gap-2 border-t border-border px-5 py-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogBody,
  DialogFooter,
}
