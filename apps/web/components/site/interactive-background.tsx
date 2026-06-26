"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/ui/cn";

export type InteractiveBackgroundVariant = "welcome" | "login" | "platform";

type InteractiveBackgroundProps = {
  variant?: InteractiveBackgroundVariant;
  className?: string;
  fixed?: boolean;
};

type ShapeKind = "orb" | "ring" | "blob";

type Shape = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  kind: ShapeKind;
  color: string;
  opacity: number;
  driftPhase: number;
  strokeWidth: number;
};

const PALETTES: Record<InteractiveBackgroundVariant, string[]> = {
  welcome: [
    "rgba(67, 56, 202, 0.42)",
    "rgba(109, 40, 217, 0.34)",
    "rgba(37, 99, 235, 0.3)",
    "rgba(244, 114, 182, 0.22)",
    "rgba(20, 184, 166, 0.18)",
  ],
  login: [
    "rgba(37, 99, 235, 0.38)",
    "rgba(109, 40, 217, 0.28)",
    "rgba(244, 114, 182, 0.2)",
    "rgba(20, 184, 166, 0.16)",
  ],
  platform: [
    "rgba(124, 58, 237, 0.4)",
    "rgba(167, 139, 250, 0.28)",
    "rgba(244, 114, 182, 0.22)",
    "rgba(20, 184, 166, 0.16)",
  ],
};

function drawBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  phase: number,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const segments = 10;
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const wobble = 1 + Math.sin(angle * 3 + phase * 1.6) * 0.14;
    const px = x + Math.cos(angle) * radius * wobble;
    const py = y + Math.sin(angle) * radius * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function createShapes(width: number, height: number, variant: InteractiveBackgroundVariant): Shape[] {
  const colors = PALETTES[variant];
  const count = Math.min(16, Math.max(9, Math.floor((width * height) / 90000)));
  const kinds: ShapeKind[] = ["orb", "ring", "blob"];

  return Array.from({ length: count }, (_, index) => {
    const baseX = width * (0.08 + Math.random() * 0.84);
    const baseY = height * (0.1 + Math.random() * 0.8);
    return {
      x: baseX,
      y: baseY,
      baseX,
      baseY,
      radius: 36 + Math.random() * 88,
      kind: kinds[index % kinds.length]!,
      color: colors[index % colors.length]!,
      opacity: 0.45 + Math.random() * 0.45,
      driftPhase: Math.random() * Math.PI * 2,
      strokeWidth: 1 + Math.random() * 1.5,
    };
  });
}

function paintBase(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: InteractiveBackgroundVariant,
) {
  ctx.fillStyle = "#070b12";
  ctx.fillRect(0, 0, width, height);

  const accent =
    variant === "platform"
      ? "rgba(124, 58, 237, 0.22)"
      : variant === "login"
        ? "rgba(37, 99, 235, 0.2)"
        : "rgba(30, 58, 95, 0.35)";

  const wash = ctx.createRadialGradient(width * 0.2, height * 0.05, 0, width * 0.35, height * 0.25, width * 0.65);
  wash.addColorStop(0, accent);
  wash.addColorStop(1, "transparent");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    width * 0.15,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.75,
  );
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, "rgba(7, 11, 18, 0.72)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/** Formas suaves que reagem ao cursor - welcome / login. */
export function InteractiveBackground({
  variant = "welcome",
  className,
  fixed = true,
}: InteractiveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shapesRef = useRef<Shape[]>([]);
  const pointerRef = useRef({ x: -9999, y: -9999, active: false });
  const rafRef = useRef(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      shapesRef.current = createShapes(width, height, variant);
      paintBase(ctx, width, height, variant);
    };

    const setPointer = (clientX: number, clientY: number) => {
      pointerRef.current = { x: clientX, y: clientY, active: true };
    };

    const onMouseMove = (event: MouseEvent) => setPointer(event.clientX, event.clientY);
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) setPointer(touch.clientX, touch.clientY);
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    const drawShape = (shape: Shape, time: number) => {
      if (shape.kind === "ring") {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.strokeWidth;
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      if (shape.kind === "blob") {
        drawBlob(ctx, shape.x, shape.y, shape.radius, shape.color, time + shape.driftPhase);
        return;
      }

      const glow = ctx.createRadialGradient(shape.x, shape.y, 0, shape.x, shape.y, shape.radius);
      glow.addColorStop(0, shape.color);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const animate = () => {
      tickRef.current += 0.014;
      const time = tickRef.current;
      const pointer = pointerRef.current;

      paintBase(ctx, width, height, variant);

      for (const shape of shapesRef.current) {
        const driftX = Math.sin(time * 0.45 + shape.driftPhase) * 22;
        const driftY = Math.cos(time * 0.38 + shape.driftPhase) * 18;
        let targetX = shape.baseX + driftX;
        let targetY = shape.baseY + driftY;

        if (pointer.active) {
          const dx = shape.x - pointer.x;
          const dy = shape.y - pointer.y;
          const distance = Math.hypot(dx, dy) || 1;
          const radius = 200 + shape.radius * 0.35;
          if (distance < radius) {
            const push = (1 - distance / radius) ** 1.6 * 62;
            targetX += (dx / distance) * push;
            targetY += (dy / distance) * push;
          }
        }

        shape.x += (targetX - shape.x) * 0.075;
        shape.y += (targetY - shape.y) * 0.075;

        ctx.save();
        ctx.globalAlpha = shape.opacity;
        drawShape(shape, time);
        ctx.restore();
      }

      if (pointer.active) {
        const cursorGlow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 130);
        cursorGlow.addColorStop(0, "rgba(244, 114, 182, 0.14)");
        cursorGlow.addColorStop(0.45, "rgba(109, 40, 217, 0.08)");
        cursorGlow.addColorStop(1, "transparent");
        ctx.fillStyle = cursorGlow;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 130, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    resize();

    if (!reducedMotion) {
      rafRef.current = requestAnimationFrame(animate);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("mouseleave", onPointerLeave);
    window.addEventListener("touchend", onPointerLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseleave", onPointerLeave);
      window.removeEventListener("touchend", onPointerLeave);
    };
  }, [variant]);

  const isPlatform = variant === "platform";
  const isLogin = variant === "login";

  return (
    <div
      className={cn(
        "pointer-events-none overflow-hidden bg-[#070b12]",
        fixed ? "fixed inset-0 z-0" : "absolute inset-0",
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          "absolute inset-0 opacity-80",
          isPlatform
            ? "bg-[radial-gradient(900px_circle_at_50%_-10%,rgba(124,58,237,0.28),transparent_60%)]"
            : isLogin
              ? "bg-[radial-gradient(900px_circle_at_50%_-10%,rgba(37,99,235,0.25),transparent_60%)]"
              : "bg-[radial-gradient(1200px_circle_at_15%_-5%,rgba(30,58,95,0.45),transparent_55%)]",
        )}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.15)_0%,rgba(7,11,18,0.55)_72%)]" />
    </div>
  );
}
