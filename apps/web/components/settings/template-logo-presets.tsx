"use client";

import type { DocumentLogoPlacement, ModuleLogoAsset } from "@nexiforma/shared";
import { LogoDragCanvas } from "@/components/settings/logo-drag-canvas";

type Props = {
  logos: ModuleLogoAsset[];
  placements: DocumentLogoPlacement[];
  onChange: (next: DocumentLogoPlacement[]) => void;
  modulo: string;
  previewHtml?: string;
};

export function TemplateLogoPresets(props: Props) {
  return <LogoDragCanvas {...props} />;
}
