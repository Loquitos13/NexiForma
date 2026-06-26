"use client";

import { useEffect, useState } from "react";

/** Telemóvel/tablet com ecrã táctil - câmara on-device. */
export function useMobileDevice() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    function check() {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const narrow = window.matchMedia("(max-width: 900px)").matches;
      const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      setMobile(touch && (coarse || narrow));
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return mobile;
}
