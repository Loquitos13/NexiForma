"use client";

import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Compass, MessageCircle, Send, X } from "lucide-react";
import {
  queryGuide,
  type GuideHistoryTurn,
  type GuideResult,
  type JwtRole,
} from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { decodeJwtRole } from "@/lib/client/jwt-role";
import { getAccessToken } from "@/lib/client/access-token";
import {
  NEXI_GUIA_ASK_EVENT,
  type NexiGuiaAskDetail,
} from "@/lib/client/nexi-guia-events";
import {
  MOBILE_NAV_EVENT,
  readMobileNavOpen,
  type MobileNavDetail,
} from "@/lib/client/mobile-nav";
import { Button } from "@/components/ui/button";

const NEXIGUIA_HIDDEN_KEY = "nexiguia-fab-hidden";
/** Desktop: círculo. Mobile: tab colada à direita (mais compacta). */
const FAB_SIZE = 56;
const FAB_MARGIN = 20;
const FAB_TAB_SIZE = 44;
const FAB_TAB_WIDTH = 40;

function rectsOverlap(a: DOMRect, b: DOMRect, pad = 8) {
  return !(
    a.right + pad < b.left ||
    a.left - pad > b.right ||
    a.bottom + pad < b.top ||
    a.top - pad > b.bottom
  );
}

function readFabHidden(): boolean {
  try {
    return window.localStorage.getItem(NEXIGUIA_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

type ChatMessage = {
  id: string;
  role: "user" | "guide";
  text: string;
  result?: GuideResult;
};

function PromptChip({ label, onPick }: { label: string; onPick: (t: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(label)}
      className="rounded-full border border-slate-700/50 bg-slate-800/70 px-2.5 py-0.5 text-[11px] text-slate-300 hover:border-blue-500/40 hover:text-slate-100 transition-colors"
    >
      {label}
    </button>
  );
}

function resultActions(
  result: GuideResult,
  onNavigate: (href: string) => void,
  onAsk: (text: string) => void,
) {
  if (result.type === "navigate") {
    return (
      <Button size="sm" className="mt-3" onClick={() => onNavigate(result.href)}>
        Abrir {result.label}
      </Button>
    );
  }

  if (result.type === "suggest") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {result.options.map((opt) => (
          <button
            key={opt.href}
            type="button"
            onClick={() => onNavigate(opt.href)}
            className="rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-left text-xs text-slate-200 hover:border-blue-500/50 hover:bg-slate-800 transition-colors"
          >
            <span className="font-medium">{opt.label}</span>
            <span className="block text-slate-500 mt-0.5">{opt.description}</span>
          </button>
        ))}
      </div>
    );
  }

  if (result.type === "answer" && result.related.length > 0) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {result.related.map((r) => (
          <button
            key={r.href}
            type="button"
            onClick={() => onNavigate(r.href)}
            className="rounded-lg border border-slate-600/50 px-2.5 py-1 text-xs text-slate-300 hover:border-blue-500/40 transition-colors"
          >
            {r.label}
          </button>
        ))}
      </div>
    );
  }

  if (result.type === "help") {
    return (
      <div className="mt-3 space-y-2">
        {result.examples.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {result.examples.map((ex) => (
              <PromptChip key={ex} label={ex} onPick={onAsk} />
            ))}
          </div>
        ) : null}
        {result.destinations.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {result.destinations.slice(0, 5).map((d) => (
              <button
                key={d.href}
                type="button"
                onClick={() => onNavigate(d.href)}
                className="rounded-lg border border-slate-600/50 px-2.5 py-1 text-xs text-slate-300 hover:border-blue-500/40 transition-colors"
              >
                {d.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if ((result.type === "unknown" || result.type === "out_of_scope") && result.suggestions.length > 0) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {result.suggestions.map((s) => (
          <button
            key={s.href}
            type="button"
            onClick={() => onNavigate(s.href)}
            className="rounded-lg border border-slate-600/50 px-2.5 py-1 text-xs text-slate-300 hover:border-blue-500/40 transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>
    );
  }

  return null;
}

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "guide",
  text: "Olá! Sou o NexiGuia, assistente do NexiForma. Ajudo-te no portal a encontrar funcionalidades, explicar módulos e ir às secções disponíveis.",
  result: {
    type: "help",
    reply: "",
    examples: ["O que é o NexiForma?", "Como te chamas?", "Ir para LMS"],
    destinations: [],
  },
};

export function NexiGuia() {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<JwtRole | null>(() =>
    typeof window !== "undefined" ? decodeJwtRole(getAccessToken()) : null,
  );
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [overlapped, setOverlapped] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setHidden(readFabHidden());
    setMobileNavOpen(readMobileNavOpen());
    const onNav = (ev: Event) => {
      const detail = (ev as CustomEvent<MobileNavDetail>).detail;
      setMobileNavOpen(Boolean(detail?.open));
      if (detail?.open) setOpen(false);
    };
    window.addEventListener(MOBILE_NAV_EVENT, onNav);
    return () => window.removeEventListener(MOBILE_NAV_EVENT, onNav);
  }, []);

  const persistHidden = useCallback((next: boolean) => {
    setHidden(next);
    try {
      window.localStorage.setItem(NEXIGUIA_HIDDEN_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (next) setOpen(false);
  }, []);

  useEffect(() => {
    if (hidden || mobileNavOpen) {
      setOverlapped(false);
      return;
    }

    const measure = () => {
      const nodes = document.querySelectorAll<HTMLElement>(
        "button, a[href], [role='button'], input, select, textarea, [role='link'], [role='tab']",
      );
      const isMobile = window.matchMedia("(max-width: 1023px)").matches;
      const fabW = isMobile ? FAB_TAB_WIDTH : FAB_SIZE;
      const fabH = isMobile ? FAB_TAB_SIZE : FAB_SIZE;
      const fabRight = isMobile ? 0 : FAB_MARGIN;
      const hasBottomNav = Boolean(document.querySelector(".portal-mobile-bottom-nav"));
      const bottomOffset = isMobile && hasBottomNav ? 74 : FAB_MARGIN;

      const fabRect = new DOMRect(
        window.innerWidth - fabRight - fabW,
        window.innerHeight - bottomOffset - fabH,
        fabW,
        fabH,
      );

      let isOverlapping = false;
      for (const el of nodes) {
        if (el.closest("[data-nexiguia-root]")) continue;
        const style = window.getComputedStyle(el);
        if (
          style.visibility === "hidden" ||
          style.display === "none" ||
          style.pointerEvents === "none" ||
          style.opacity === "0"
        ) {
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        if (
          r.bottom <= 0 ||
          r.top >= window.innerHeight ||
          r.right <= 0 ||
          r.left >= window.innerWidth
        ) {
          continue;
        }
        if (rectsOverlap(fabRect, r, 6)) {
          isOverlapping = true;
          break;
        }
      }

      setOverlapped((prev) => (prev === isOverlapping ? prev : isOverlapping));
    };

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      mo.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [hidden, mobileNavOpen, pathname]);

  useEffect(() => {
    setRole(decodeJwtRole(getAccessToken()));
    void bffFetch("/api/auth/me", { headers: { accept: "application/json" } })
      .then(async (r) => {
        if (!r.ok) {
          setRole(decodeJwtRole(getAccessToken()));
          return;
        }
        const data = (await r.json()) as { role?: JwtRole } | null;
        setRole(data?.role ?? decodeJwtRole(getAccessToken()));
      })
      .catch(() => setRole(decodeJwtRole(getAccessToken())));
  }, [pathname]);

  useEffect(() => {
    const help = queryGuide("ajuda", { role, pathname });
    if (help.type !== "help") return;
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.id !== "welcome") return prev;
      return [{ ...prev[0]!, result: help }];
    });
  }, [pathname, role]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      if (href.includes("#")) {
        const [path, hash] = href.split("#");
        const basePath = path || "/";
        if (basePath === pathname || (basePath === "/" && pathname === "/")) {
          const el = document.getElementById(hash ?? "");
          if (el) {
            el.scrollIntoView({ behavior: "smooth" });
            window.history.replaceState(null, "", href);
            return;
          }
        }
      }
      router.push(href);
    },
    [pathname, router],
  );

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || thinking) return;

      const history: GuideHistoryTurn[] = messages
        .filter((m) => m.id !== "welcome")
        .slice(-6)
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          text: m.text,
        }));

      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-u`, role: "user", text: trimmed },
      ]);
      setInput("");
      setThinking(true);

      let result: GuideResult = queryGuide(trimmed, { role, pathname, history });

      try {
        if (result.type !== "out_of_scope") {
          const res = await bffFetch("/api/v1/guide/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({ message: trimmed, pathname, history }),
          });
          if (res.ok) {
            const data = (await res.json()) as GuideResult & { engine?: string };
            const { engine: _engine, ...guideResult } = data;
            result = guideResult;
          }
        }
      } catch {
        /* fallback local */
      } finally {
        setThinking(false);
      }

      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-g`, role: "guide", text: result.reply, result },
      ]);
    },
    [role, pathname, thinking],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(input);
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, thinking]);

  useEffect(() => {
    const onAsk = (ev: Event) => {
      const detail = (ev as CustomEvent<NexiGuiaAskDetail>).detail;
      const prompt = detail?.prompt?.trim();
      if (!prompt) return;
      persistHidden(false);
      setOpen(true);
      if (detail.autoSend === false) {
        setInput(prompt);
        return;
      }
      void submit(prompt);
    };
    window.addEventListener(NEXI_GUIA_ASK_EVENT, onAsk);
    return () => window.removeEventListener(NEXI_GUIA_ASK_EVENT, onAsk);
  }, [submit, persistHidden]);

  const fabSuppressed = mobileNavOpen || (overlapped && !open);
  /** Semi-pill fica visível com o chat aberto (fecha ao tocar); só some se hidden ou se sobreposta com opções. */
  const showPill = !fabSuppressed && !hidden;
  const showChat = open && !mobileNavOpen;

  function toggleChat() {
    setOpen((v) => !v);
  }

  function closeChat() {
    setOpen(false);
  }

  return (
    <div data-nexiguia-root className={showChat ? "nexiguia-root-open" : undefined}>
      {/* Chat aberto: blur no fundo (z-index: 0 no stacking context do root) */}
      {showChat ? (
        <button
          type="button"
          className="nexiguia-backdrop"
          aria-label="Fechar NexiGuia"
          onClick={closeChat}
        />
      ) : null}

      {/* Semi-pill: abre/fecha o chat; com chat aberto fica no mesmo z-index da janela */}
      {showPill ? (
        <button
          type="button"
          onClick={toggleChat}
          title="NexiGuia - clica com o botão direito para esconder"
          onContextMenu={(e) => {
            e.preventDefault();
            persistHidden(true);
          }}
          className="nexiguia-fab fixed flex items-center justify-center transition-all duration-300"
          style={{
            bottom: `calc(${FAB_MARGIN}px + env(safe-area-inset-bottom, 0px))`,
            color: "var(--ui-accent)",
            borderColor: "var(--ui-accent)",
            background:
              "linear-gradient(145deg, color-mix(in srgb, var(--ui-panel, var(--ui-bg)) 88%, var(--ui-accent-soft)) 0%, color-mix(in srgb, var(--ui-bg) 92%, var(--ui-accent-soft)) 100%)",
            boxShadow:
              "0 0 0 1px color-mix(in srgb, var(--ui-accent) 25%, transparent), 0 0 18px color-mix(in srgb, var(--ui-accent) 40%, transparent)",
          }}
          aria-label={open ? "Fechar NexiGuia" : "Abrir NexiGuia"}
          aria-expanded={open}
        >
          {open ? (
            <X className="nexiguia-fab-icon" style={{ color: "var(--ui-accent)" }} />
          ) : (
            <Compass className="nexiguia-fab-icon" style={{ color: "var(--ui-accent)" }} />
          )}
        </button>
      ) : null}

      {showChat ? (
        <div
          className="nexiguia-panel fixed flex w-[min(100vw-2.5rem,24rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            bottom: `calc(${FAB_MARGIN + 12}px + env(safe-area-inset-bottom, 0px) + var(--nexiguia-fab-h, 2.75rem))`,
            borderColor: "color-mix(in srgb, var(--ui-border, #334155) 80%, transparent)",
            background: "color-mix(in srgb, var(--ui-panel, #0c1220) 97%, transparent)",
          }}
        >
          <div className="flex items-center gap-2 border-b border-[color:color-mix(in_srgb,var(--ui-border,#334155)_55%,transparent)] px-4 py-3">
            <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "var(--ui-accent)" }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[color:var(--ui-fg,#f1f5f9)]">NexiGuia</p>
              <p className="truncate text-[10px] text-[color:var(--ui-muted,#64748b)]">
                Assistente NexiForma
              </p>
            </div>
            {/* Desktop: X no header. Mobile: fecha pela semi-pill. */}
            <button
              type="button"
              onClick={closeChat}
              title="Fechar"
              aria-label="Fechar NexiGuia"
              className="nexiguia-panel-close hidden rounded-md p-1.5 text-[color:var(--ui-muted,#64748b)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--ui-accent)_12%,transparent)] hover:text-[color:var(--ui-fg,#f1f5f9)] lg:inline-flex"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex max-h-80 flex-col gap-3 overflow-y-auto px-4 py-3">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "ml-6 text-right" : "mr-4 text-left"}>
                <div
                  className={[
                    "inline-block max-w-full rounded-xl px-3 py-2 text-sm leading-relaxed text-left",
                    m.role === "user"
                      ? "bg-blue-600/90 text-white"
                      : "bg-slate-800/80 text-slate-200 border border-slate-700/40",
                  ].join(" ")}
                >
                  {m.text}
                  {m.role === "guide" && m.result
                    ? resultActions(m.result, navigate, submit)
                    : null}
                </div>
              </div>
            ))}
            {thinking ? (
              <div className="mr-4 text-left">
                <div className="inline-flex items-center gap-1 rounded-xl border border-slate-700/40 bg-slate-800/80 px-3 py-2 text-sm text-slate-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400 [animation-delay:300ms]" />
                </div>
              </div>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-slate-700/40 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunta ou pede para ir a uma secção…"
              disabled={thinking}
              className="min-w-0 flex-1 rounded-lg border border-slate-700/50 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
              autoComplete="off"
            />
            <Button type="submit" size="sm" disabled={!input.trim() || thinking} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
