"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import {
  mmToCssPx,
  pageDimensionsMm,
  type DocumentOrientacao,
} from "@nexiforma/shared";

/** Escala uma página A4 para caber na largura do contentor (como no editor WYSIWYG). */
export function useA4PageScale(
  containerRef: RefObject<HTMLElement | null>,
  orientacao: DocumentOrientacao = "portrait",
) {
  const pageMm = pageDimensionsMm(orientacao);
  const pageWidthPx = mmToCssPx(pageMm.width);
  const pageHeightPx = mmToCssPx(pageMm.height);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const avail = el.clientWidth;
      if (!avail) return;
      setScale(Math.min(1, avail / pageWidthPx));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageWidthPx, orientacao]);

  return { scale, pageWidthPx, pageHeightPx };
}
