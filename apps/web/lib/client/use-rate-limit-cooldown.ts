"use client";

import { useCallback, useEffect, useState } from "react";
import { retryAfterSecFromResponse } from "./rate-limit-retry";

export function useRateLimitCooldown() {
  const [retryUntilMs, setRetryUntilMs] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);

  const applyFromResponse = useCallback((res: Response) => {
    const sec = retryAfterSecFromResponse(res);
    if (sec <= 0) return;
    setRetryUntilMs(Date.now() + sec * 1000);
  }, []);

  const clearCooldown = useCallback(() => {
    setRetryUntilMs(null);
    setRemainingSec(0);
  }, []);

  useEffect(() => {
    if (!retryUntilMs) {
      setRemainingSec(0);
      return;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((retryUntilMs - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) setRetryUntilMs(null);
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [retryUntilMs]);

  return {
    remainingSec,
    isCoolingDown: remainingSec > 0,
    applyFromResponse,
    clearCooldown,
  };
}
