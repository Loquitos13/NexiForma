"use client";

import { memo } from "react";
import {
  mmToCssPx,
  pageDimensionsMm,
  type DocumentOrientacao,
  type DocumentVerticalAlign,
} from "@nexiforma/shared";
import { cn } from "@/lib/ui/cn";

const THUMB_SCALE = 0.16;

type Props = {
  pages: string[];
  activeIndex: number;
  orientacao?: DocumentOrientacao;
  verticalAlign?: DocumentVerticalAlign;
  editorCss: string;
  onSelect: (index: number) => void;
  className?: string;
};

function DocumentPageNavInner({
  pages,
  activeIndex,
  orientacao = "portrait",
  verticalAlign = "top",
  editorCss,
  onSelect,
  className,
}: Props) {
  const pageMm = pageDimensionsMm(orientacao);
  const pageWidthPx = mmToCssPx(pageMm.width);
  const pageHeightPx = mmToCssPx(pageMm.height);
  const thumbWidth = pageWidthPx * THUMB_SCALE;
  const thumbHeight = pageHeightPx * THUMB_SCALE;

  return (
    <div className={cn("grid shrink-0 grid-cols-1 gap-2 overflow-y-auto py-3 pl-3 pr-1", className)}>
      <style>{editorCss.replace(/\.doc-editor-root/g, ".doc-page-nav-root")}</style>
      <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Páginas</p>
      {pages.map((pageHtml, index) => {
        const selected = index === activeIndex;
        return (
          <button
            key={`page-thumb-${index}-${pageHtml.length}`}
            type="button"
            title={`Página ${index + 1}`}
            onClick={() => onSelect(index)}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={cn(
                "doc-page-nav-root overflow-hidden rounded-sm bg-white shadow-sm ring-2 transition-shadow",
                selected ? "ring-blue-500" : "ring-transparent hover:ring-slate-600",
              )}
              style={{ width: thumbWidth, height: thumbHeight }}
            >
              <div
                className="origin-top-left"
                style={{
                  width: pageWidthPx,
                  height: pageHeightPx,
                  transform: `scale(${THUMB_SCALE})`,
                }}
              >
                <div
                  className="doc-page-shell"
                  style={{
                    width: `${pageMm.width}mm`,
                    height: `${pageMm.height}mm`,
                  }}
                >
                  <div className="doc-page-body" data-v-align={verticalAlign}>
                    <div
                      className="doc-content-layer pointer-events-none select-none"
                      dangerouslySetInnerHTML={{
                        __html: pageHtml?.trim() ? pageHtml : "<p><br></p>",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <span
              className={cn(
                "text-[11px] font-medium tabular-nums",
                selected ? "text-blue-300" : "text-slate-400",
              )}
            >
              {index + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const DocumentPageNav = memo(DocumentPageNavInner);
