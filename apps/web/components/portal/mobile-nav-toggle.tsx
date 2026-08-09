"use client";

import { Menu, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

type OpenProps = {
  variant: "open";
  onClick: () => void;
  className?: string;
};

type CloseProps = {
  variant: "close";
  onClick: () => void;
  className?: string;
};

type Props = OpenProps | CloseProps;

/** Abrir (hamburger na topbar) ou fechar (X dentro do drawer). */
export function MobileNavToggle(props: Props) {
  if (props.variant === "open") {
    return (
      <button
        type="button"
        onClick={props.onClick}
        className={cn("ui-icon-btn relative rounded-lg p-2", props.className)}
        aria-label="Abrir menu"
        aria-expanded={false}
      >
        <Menu className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn("ui-mobile-nav-close ui-icon-btn shrink-0 rounded-lg p-2 lg:hidden", props.className)}
      aria-label="Fechar menu"
      aria-expanded
    >
      <X className="h-5 w-5" />
    </button>
  );
}
