"use client";

import * as React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

function preventModalDismiss(event: Event) {
  event.preventDefault();
}

export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;

type SheetContentProps = RadixDialog.DialogContentProps & {
  title?: string;
  description?: string;
  side?: "right" | "left";
};

export function SheetContent({
  className,
  children,
  title,
  description,
  side = "right",
  ...props
}: SheetContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <RadixDialog.Content
        onPointerDownOutside={preventModalDismiss}
        onInteractOutside={preventModalDismiss}
        onEscapeKeyDown={preventModalDismiss}
        className={cn(
          "fixed z-50 flex h-full flex-col border-slate-700/60 bg-slate-900 shadow-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-300",
          side === "right"
            ? "inset-y-0 right-0 w-full max-w-xl border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
            : "inset-y-0 left-0 w-full max-w-xl border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          className,
        )}
        {...props}
      >
        {(title || description) && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-700/50 px-6 py-4">
            <div className="min-w-0">
              {title ? (
                <RadixDialog.Title className="text-base font-semibold text-slate-100">
                  {title}
                </RadixDialog.Title>
              ) : null}
              {description ? (
                <RadixDialog.Description className="mt-0.5 text-sm text-slate-400">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close
              className="rounded-md p-1 text-slate-500 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" aria-hidden />
            </RadixDialog.Close>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-6">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
