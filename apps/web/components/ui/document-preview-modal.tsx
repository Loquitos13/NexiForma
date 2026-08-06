"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  title: string;
  url: string | null;
  onClose: () => void;
};

export function DocumentPreviewModal({ open, title, url, onClose }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title={title} className="max-w-4xl">
        {url ? (
          <iframe title={title} src={url} className="h-[70vh] w-full rounded-lg bg-white" />
        ) : (
          <p className="text-sm text-slate-400">Sem pré-visualização.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
