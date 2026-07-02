import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const apiKey = process.env.BREVO_API_KEY?.trim();
if (!apiKey) {
  console.error("BREVO_API_KEY em falta no .env");
  process.exit(1);
}

const to = process.argv[2] || process.env.MAIL_REPLY_TO || "suporte@nexiforma.pt";
const fromRaw = process.env.MAIL_FROM || "NexiForma <noreply@nexiforma.pt>";
const m = fromRaw.match(/^(.+?)\s*<([^>]+)>$/);
const sender = m
  ? { name: m[1].trim(), email: m[2].trim() }
  : { name: "NexiForma", email: fromRaw.trim() };
const replyTo = process.env.MAIL_REPLY_TO?.trim();

const res = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "api-key": apiKey,
    "Content-Type": "application/json",
    accept: "application/json",
  },
  body: JSON.stringify({
    sender,
    to: [{ email: to }],
    ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    subject: "NexiForma – teste Brevo API",
    textContent: "Email de teste via Brevo API. Se recebeste isto, a configuração está OK.",
    htmlContent: "<p>Email de <strong>teste</strong> NexiForma via <strong>Brevo API</strong>.</p>",
  }),
});

if (!res.ok) {
  console.error("Brevo API falhou:", res.status, await res.text());
  process.exit(1);
}

const body = await res.json();
console.log("Email enviado via Brevo API.");
console.log("Para:", to);
console.log("De:", sender.email);
if (body.messageId) console.log("messageId:", body.messageId);
