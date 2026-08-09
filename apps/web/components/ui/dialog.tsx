"use client";

import * as React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

function preventModalDismiss(event: Event) {
  event.preventDefault();
}

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: RadixDialog.DialogContentProps & { title?: string; description?: string }) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <RadixDialog.Content
        onPointerDownOutside={preventModalDismiss}
        onInteractOutside={preventModalDismiss}
        onEscapeKeyDown={preventModalDismiss}
        className={cn(
          "ui-modal fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col",
          "max-h-[min(90dvh,720px)]",
          "rounded-2xl border shadow-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          "overflow-hidden",
          className,
        )}
        {...props}
      >
        {/* header */}
        {(title || description) && (
          <div className="ui-modal-header flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4">
            <div className="min-w-0">
              {title && (
                <RadixDialog.Title className="ui-modal-title text-base font-semibold">
                  {title}
                </RadixDialog.Title>
              )}
              {description && (
                <RadixDialog.Description className="ui-modal-desc mt-0.5 text-sm">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              className="ui-modal-close rounded-md p-1 focus-visible:outline-none focus-visible:ring-2"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" aria-hidden />
            </RadixDialog.Close>
          </div>
        )}
        <div className="ui-themed-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
          {children}
        </div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
