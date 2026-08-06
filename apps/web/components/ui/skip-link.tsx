"use client";

/** Link visível apenas ao focar - WCAG 2.4.1 Bypass Blocks */
export function SkipLink() {
  return (
    <a href="#main-content" className="skip-link">
      Saltar para o conteúdo principal
    </a>
  );
}
