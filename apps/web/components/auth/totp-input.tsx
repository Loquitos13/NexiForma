"use client";

import { useRef } from "react";

export function TotpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function setDigit(index: number, char: string) {
    const clean = char.replace(/\D/g, "").slice(-1);
    const next = digits.map((d, i) => (i === index ? clean : d.trim())).join("").slice(0, 6);
    onChange(next);
    if (clean && index < 5) refs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, key: string) {
    if (key === "Backspace" && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  function onPaste(text: string) {
    const clean = text.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    refs.current[Math.min(clean.length, 5)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e.key)}
          onPaste={(e) => {
            e.preventDefault();
            onPaste(e.clipboardData.getData("text"));
          }}
          className="h-12 w-10 sm:h-14 sm:w-12 rounded-xl border border-slate-600/60 bg-slate-900/90 text-center text-xl font-mono font-semibold text-slate-100 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
