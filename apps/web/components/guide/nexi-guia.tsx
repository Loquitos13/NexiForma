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
import { Button } from "@/components/ui/button";

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
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const listRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="NexiGuia"
        className="fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-teal-600 text-white shadow-lg shadow-blue-900/50 ring-2 ring-white/10 hover:scale-105 hover:brightness-110 transition-all"
        aria-label={open ? "Fechar NexiGuia" : "Abrir NexiGuia"}
      >
        {open ? <X className="h-5 w-5" /> : <Compass className="h-6 w-6" />}
      </button>

      {open ? (
        <div className="fixed bottom-[5.25rem] right-5 z-[100] flex w-[min(100vw-2.5rem,24rem)] flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-[#0c1220]/97 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-slate-700/40 px-4 py-3">
            <MessageCircle className="h-4 w-4 shrink-0 text-teal-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-100">NexiGuia</p>
              <p className="text-[10px] text-slate-500 truncate">Assistente NexiForma</p>
            </div>
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
    </>
  );
}
