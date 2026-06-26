"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Atraso em ms antes da animação */
  delay?: number;
  /** Mostrar imediatamente (ex.: hero acima da dobra) */
  immediate?: boolean;
};

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  immediate = false,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(immediate);
  const lastScrollY = useRef(0);
  const scrollDir = useRef<"up" | "down">("down");

  useEffect(() => {
    if (immediate) return;

    const onScroll = () => {
      const y = window.scrollY;
      scrollDir.current = y > lastScrollY.current ? "down" : "up";
      lastScrollY.current = y;
    };

    lastScrollY.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [immediate]);

  useEffect(() => {
    if (immediate) return;

    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      setVisible(true);
    }
  }, [immediate]);

  useEffect(() => {
    if (immediate) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && scrollDir.current === "down") {
          setVisible(true);
        } else if (!entry.isIntersecting && scrollDir.current === "up") {
          setVisible(false);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate]);

  return (
    <div
      ref={ref}
      data-visible={visible}
      className={[
        "scroll-reveal transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8 pointer-events-none",
        className,
      ].join(" ")}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
