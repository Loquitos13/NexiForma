"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Esconde o chrome do header ao fazer scroll-down num contentor com overflow;
 * volta a mostrar ao scroll-up. Sem overflow → nunca colapsa.
 */
export function useHeaderScrollCollapse(
  scrollRef: RefObject<HTMLElement | null>,
  threshold = 12,
) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let lastY = el.scrollTop;

    const onScroll = () => {
      const y = el.scrollTop;
      const hasOverflow = el.scrollHeight > el.clientHeight + 8;
      if (!hasOverflow) {
        setCollapsed(false);
        lastY = y;
        return;
      }
      if (y > lastY + threshold && y > 24) {
        setCollapsed(true);
      } else if (y < lastY - threshold) {
        setCollapsed(false);
      }
      lastY = y;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef, threshold]);

  return collapsed;
}
