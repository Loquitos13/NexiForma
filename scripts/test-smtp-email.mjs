import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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

const to = process.argv[2] || process.env.MAIL_REPLY_TO || "suporte@nexiforma.pt";
const from = process.env.MAIL_FROM || "NexiForma <noreply@nexiforma.pt>";
const host = process.env.SMTP_HOST;
const brevoKey = process.env.BREVO_API_KEY?.trim();
const mailProvider = process.env.MAIL_PROVIDER?.trim().toLowerCase();

if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  if (brevoKey && (mailProvider === "brevo" || !mailProvider || mailProvider === "log")) {
    console.log("MAIL_PROVIDER=brevo com BREVO_API_KEY – teste via API (não SMTP).\n");
    const args = [resolve(dirname(fileURLToPath(import.meta.url)), "test-brevo-email.mjs")];
    if (process.argv[2]) args.push(process.argv[2]);
    const result = spawnSync(process.execPath, args, { stdio: "inherit", cwd: root });
    process.exit(result.status ?? 1);
  }
  console.error("Faltam SMTP_HOST, SMTP_USER ou SMTP_PASS no .env");
  if (brevoKey) {
    console.error("Tens BREVO_API_KEY – usa: node scripts/test-brevo-email.mjs");
  }
  process.exit(1);
}

console.log("SMTP host:", host);
console.log("SMTP user:", process.env.SMTP_USER);

const ports = [
  { port: 587, secure: false },
  { port: 465, secure: true },
  { port: 2525, secure: false },
];

let transport;
let usedPort = 587;

for (const cfg of ports) {
  const t = nodemailer.createTransport({
    host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    family: 4,
  });
  try {
    await t.verify();
    transport = t;
    usedPort = cfg.port;
    console.log("SMTP: ligação OK (porta", cfg.port + ")");
    break;
  } catch (err) {
    console.log("Porta", cfg.port, "falhou:", err.message || err);
  }
}

if (!transport) {
  console.error("Nenhuma porta autenticou (535). Regenera a chave SMTP no Brevo.");
  process.exit(1);
}

try {
  const info = await transport.sendMail({
    from,
    to,
    replyTo: process.env.MAIL_REPLY_TO,
    subject: "NexiForma – teste SMTP Brevo",
    text: "Email de teste enviado pela NexiForma. Se recebeste isto, o SMTP Brevo está OK.",
    html: "<p>Email de <strong>teste</strong> NexiForma + Brevo.</p><p>SMTP configurado correctamente.</p>",
  });
  console.log("Email enviado com sucesso.");
  console.log("messageId:", info.messageId);
  console.log("Para:", to);
  console.log("Porta:", usedPort);
} catch (err) {
  console.error("Envio falhou:", err.message || err);
  process.exit(1);
}
