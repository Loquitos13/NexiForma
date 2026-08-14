"use client";

import { useEffect, useState } from "react";

/** Viewport compacto (portal mobile/tablet, alinhado com bottom nav). */
export function useCompactTable(maxWidthPx = 1023): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [maxWidthPx]);

  return compact;
}
