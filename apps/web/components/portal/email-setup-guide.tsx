"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

type Provider = "brevo" | "resend";

const ENV_BREVO = `# Brevo – colar no .env na raiz do NexiForma
MAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=SEU_LOGIN_SMTP_BREVO
SMTP_PASS=SUA_CHAVE_SMTP_BREVO

MAIL_FROM="NexiForma <noreply@teu-dominio.pt>"
MAIL_REPLY_TO=suporte@teu-dominio.pt
APP_PUBLIC_URL=https://app.teu-dominio.pt
CRON_NOTIFICACOES_ENABLED=true`;

const ENV_RESEND = `# Resend – colar no .env na raiz do NexiForma
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=re_SUA_API_KEY

MAIL_FROM="NexiForma <noreply@teu-dominio.pt>"
MAIL_REPLY_TO=suporte@teu-dominio.pt
APP_PUBLIC_URL=https://app.teu-dominio.pt
CRON_NOTIFICACOES_ENABLED=true`;

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border border-slate-700/50 bg-slate-950/80 p-3 text-[11px] leading-relaxed text-slate-300">
        {text}
      </pre>
      <button
        type="button"
        onClick={() => void copy()}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-slate-600/50 bg-slate-800/90 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

export function EmailSetupGuide() {
  const [open, setOpen] = useState(true);
  const [provider, setProvider] = useState<Provider>("brevo");

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-950/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Configurar email (Brevo ou Resend)</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Plano grátis · passo a passo · só precisas de DNS + .env
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>

      {open ? (
        <div className="space-y-4 border-t border-blue-500/10 px-5 pb-5 pt-4">
          <div className="flex gap-2">
            {(["brevo", "resend"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  provider === p
                    ? "bg-blue-600/30 text-blue-200 ring-1 ring-blue-500/40"
                    : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
                }`}
              >
                {p === "brevo" ? "Brevo (~300/dia)" : "Resend (~3000/mês)"}
              </button>
            ))}
          </div>

          {provider === "brevo" ? (
            <ol className="list-decimal space-y-2 pl-4 text-xs text-slate-400">
              <li>
                Conta grátis em{" "}
                <a
                  href="https://www.brevo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  brevo.com
                </a>
              </li>
              <li>
                <strong className="text-slate-300">Domains</strong> → adiciona{" "}
                <code className="text-slate-300">teu-dominio.pt</code> → copia SPF + DKIM para o DNS
              </li>
              <li>
                <strong className="text-slate-300">Senders</strong> → remetente{" "}
                <code className="text-slate-300">noreply@teu-dominio.pt</code>
              </li>
              <li>
                <strong className="text-slate-300">SMTP &amp; API</strong> → copia login + chave SMTP
              </li>
              <li>Cola no <code className="text-slate-300">.env</code> abaixo e reinicia a API</li>
              <li>Testa com «Enviar digest» nesta página</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-4 text-xs text-slate-400">
              <li>
                Conta grátis em{" "}
                <a
                  href="https://resend.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  resend.com
                </a>
              </li>
              <li>
                <strong className="text-slate-300">Domains</strong> → adiciona domínio → publica SPF + DKIM
              </li>
              <li>
                <strong className="text-slate-300">API Keys</strong> → cria key com «Sending access»
              </li>
              <li>
                SMTP: user fixo <code className="text-slate-300">resend</code>, password = API key
              </li>
              <li>Cola no <code className="text-slate-300">.env</code> e reinicia a API</li>
              <li>Testa com «Enviar digest» nesta página</li>
            </ol>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">Registos DNS recomendados</p>
            <ul className="space-y-1 text-[11px] text-slate-500">
              <li>
                <strong className="text-slate-400">SPF (TXT @):</strong>{" "}
                {provider === "brevo"
                  ? "v=spf1 include:spf.brevo.com ~all"
                  : "valor exacto na consola Resend (include:amazonses.com)"}
              </li>
              <li>
                <strong className="text-slate-400">DKIM:</strong> CNAME/TXT gerados pelo serviço
              </li>
              <li>
                <strong className="text-slate-400">DMARC (TXT _dmarc):</strong>{" "}
                v=DMARC1; p=none; rua=mailto:dmarc@teu-dominio.pt
              </li>
            </ul>
          </div>

          <CopyBlock text={provider === "brevo" ? ENV_BREVO : ENV_RESEND} />

          <p className="text-[11px] text-slate-500">
            Guia completo no repositório:{" "}
            <code className="text-slate-400">docs/EMAIL_SMTP_SETUP.md</code> - substitui{" "}
            <code className="text-slate-400">teu-dominio.pt</code> pelo teu domínio real.
          </p>
        </div>
      ) : null}
    </div>
  );
}
