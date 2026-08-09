"use client";

import { useLayoutEffect, useRef } from "react";

function portalScrollEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(".portal-scroll-main");
}

/**
 * Preserva a posição de scroll do portal ao mudar página / page size,
 * sem impedir o utilizador de fazer scroll livre depois.
 */
export function usePinnedPortalScroll(deps: readonly unknown[]) {
  const pinRef = useRef(false);
  const topRef = useRef(0);

  function pin() {
    pinRef.current = true;
    topRef.current = portalScrollEl()?.scrollTop ?? window.scrollY;
  }

  useLayoutEffect(() => {
    if (!pinRef.current) return;
    pinRef.current = false;
    const scroller = portalScrollEl();
    if (scroller) {
      scroller.scrollTop = topRef.current;
      return;
    }
    window.scrollTo({ top: topRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps explícitos do caller
  }, deps);

  return { pin };
}
