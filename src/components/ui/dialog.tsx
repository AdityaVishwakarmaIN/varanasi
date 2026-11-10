"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[hsl(234_50%_4%/0.72)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * S5-T10: on phones (< 640 px) every dialog is a bottom sheet: full width, anchored to the
 * bottom, at most 85% of the screen tall, scrollable, and padded for the home bar. These are
 * `max-sm:` variants, so they win over the panels' own desktop sizes (e.g. `max-w-[400px]`).
 */
const BOTTOM_SHEET_CLASSES =
  "max-sm:left-0 max-sm:translate-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-none max-sm:max-h-[85dvh] max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:rounded-b-none max-sm:rounded-t-none max-sm:border-x-0 max-sm:border-b-0 max-sm:px-4 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom-full max-sm:data-[state=closed]:slide-out-to-bottom-full max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100"

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Adds a visible close (X) button top-right. Leave off for dialogs that need an answer. */
    showClose?: boolean
  }
>(({ className, children, showClose = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain translate-x-[-50%] translate-y-[-50%] gap-4 border border-chrome-border bg-chrome-panel text-chrome-text p-6 shadow-[0_1px_2px_rgb(60_40_20/0.18)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%] rounded-none",
        BOTTOM_SHEET_CLASSES,
        className
      )}
      {...props}
    >
      <div aria-hidden className="sm:hidden mx-auto -mt-3 h-1.5 w-10 rounded-full bg-chrome-border" />
      {children}
      {showClose && (
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-3 top-3 max-sm:right-1.5 max-sm:top-1.5 flex h-8 w-8 max-sm:h-11 max-sm:w-11 items-center justify-center rounded-none text-chrome-muted transition-colors hover:bg-chrome-well hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg className="h-4 w-4" aria-hidden fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "font-sans text-xl font-semibold leading-tight text-chrome-text",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-chrome-muted", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}





