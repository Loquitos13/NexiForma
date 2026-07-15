"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";

const AUTO_INTERVAL_MS = 10_000;
const HEIGHT_TRANSITION_MS = 350;

type Props = {
  children: ReactNode;
  className?: string;
  pauseOnHover?: boolean;
  autoPlay?: boolean;
  ariaLabel?: string;
  /** Altura fixa do viewport (px). Desactiva medição automática. */
  fixedHeight?: number;
  onIndexChange?: (index: number) => void;
};

export function ContentCarousel({
  children,
  className,
  pauseOnHover = true,
  autoPlay = true,
  ariaLabel = "Carrossel",
  fixedHeight,
  onIndexChange,
}: Props) {
  const slides = Children.toArray(children).filter(Boolean);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [paused, setPaused] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | undefined>();
  const touchStart = useRef<number | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const measureActiveSlide = useCallback(() => {
    const el = slideRefs.current[index];
    if (!el) return;
    setViewportHeight(el.offsetHeight);
  }, [index]);

  useLayoutEffect(() => {
    if (fixedHeight != null) return;
    measureActiveSlide();
    const el = slideRefs.current[index];
    if (!el) return;
    const ro = new ResizeObserver(() => measureActiveSlide());
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, measureActiveSlide, slides.length, fixedHeight]);

  const viewportPx = fixedHeight ?? viewportHeight;

  const go = useCallback(
    (next: number) => {
      if (count <= 0) return;
      const idx = ((next % count) + count) % count;
      setIndex(idx);
      onIndexChange?.(idx);
      setPaused(true);
    },
    [count, onIndexChange],
  );

  useEffect(() => {
    if (!autoPlay || count <= 1 || paused || (pauseOnHover && hovering)) return;
    const t = window.setInterval(() => go((index + 1) % count), AUTO_INTERVAL_MS);
    return () => clearInterval(t);
  }, [autoPlay, count, paused, hovering, pauseOnHover, go, index]);

  if (count === 0) return null;

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={(e) => {
        touchStart.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (start == null) return;
        const delta = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(delta) < 40) return;
        go(delta > 0 ? index - 1 : index + 1);
      }}
      aria-roledescription="carrossel"
      aria-label={ariaLabel}
    >
      <div
        className="overflow-hidden rounded-xl transition-[height] ease-out"
        style={{
          height: viewportPx != null ? `${viewportPx}px` : "auto",
          transitionDuration: `${HEIGHT_TRANSITION_MS}ms`,
        }}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              className="w-full shrink-0 self-start"
              aria-hidden={i !== index}
            >
              {isValidElement(slide)
                ? cloneElement(slide as ReactElement<{ isActive?: boolean }>, {
                    isActive: i === index,
                  })
                : slide}
            </div>
          ))}
        </div>
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="absolute left-2 top-[40%] z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-950/80 text-slate-300 shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-800 sm:h-9 sm:w-9"
            aria-label="Slide anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="absolute right-2 top-[40%] z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-950/80 text-slate-300 shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-800 sm:h-9 sm:w-9"
            aria-label="Slide seguinte"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === index ? "w-5 bg-violet-400" : "w-2 bg-slate-600 hover:bg-slate-500",
                )}
                aria-label={`Ir para slide ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
