import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[trimmed.slice(0, eq).trim()] = value;
}

const apiKey = process.env.BREVO_API_KEY?.trim();
if (!apiKey) {
  console.error("BREVO_API_KEY em falta");
  process.exit(1);
}

const headers = { "api-key": apiKey, accept: "application/json" };

async function get(path) {
  const res = await fetch(`https://api.brevo.com/v3${path}`, { headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json };
}

console.log("=== Conta Brevo ===");
const account = await get("/account");
if (!account.ok) {
  console.error("Erro conta:", account.status, account.json);
  process.exit(1);
}
console.log("Email login:", account.json.email);
console.log("Plano:", account.json.plan?.[0]?.type, "| créditos:", account.json.plan?.[0]?.credits);
console.log("Empresa:", account.json.companyName);

console.log("\n=== Remetentes (Senders) ===");
const senders = await get("/senders");
if (senders.ok) {
  for (const s of senders.senders ?? senders.json?.senders ?? []) {
    console.log(`- ${s.email} | activo: ${s.active} | verificado: ${!!s.verified}`);
  }
} else {
  console.log("Erro:", senders.status, senders.json);
}

console.log("\n=== Domínios ===");
const domains = await get("/senders/domains");
if (domains.ok) {
  const list = domains.json?.domains ?? domains.json ?? [];
  for (const d of list) {
    console.log(`- ${d.domain_name ?? d.domain} | autenticado: ${d.authenticated ?? d.verified}`);
  }
} else {
  console.log("Erro:", domains.status, domains.json);
}

console.log("\n=== Emails transaccionais (por destinatário) ===");
const recipients = [...new Set([process.argv[2], process.env.MAIL_REPLY_TO, "bdiogo511@gmail.com"].filter(Boolean))];
for (const email of recipients) {
  const emails = await get(`/smtp/emails?email=${encodeURIComponent(email)}&limit=5&sort=desc`);
  console.log(`\nDestinatário: ${email}`);
  if (!emails.ok) {
    console.log("Erro:", emails.status, emails.json);
    continue;
  }
  const list = emails.json?.transactionalEmails ?? [];
  if (!list.length) console.log("(nenhum registo)");
  for (const e of list) {
    console.log(`- ${e.date} | ${e.subject} | de: ${e.from} | uuid: ${e.uuid}`);
    if (e.uuid) {
      const detail = await get(`/smtp/emails/${e.uuid}`);
      if (detail.ok) {
        const d = detail.json;
        const events = (d.events ?? []).map((ev) => ev.name).join(" → ");
        console.log(`  eventos: ${events || "(sem eventos)"}`);
        if (events.includes("error")) {
          console.log("  ⚠ Entrega falhou - remetente/domínio provavelmente não autorizado na Brevo.");
        }
        if (events.includes("delivered")) {
          console.log("  ✓ Entregue na caixa de destino.");
        }
      }
    }
  }
}

const fromRaw = process.env.MAIL_FROM || "";
const m = fromRaw.match(/<([^>]+)>/);
const fromEmail = m ? m[1] : fromRaw;
console.log("\n=== Config .env ===");
console.log("MAIL_FROM:", fromRaw);
console.log("MAIL_REPLY_TO:", process.env.MAIL_REPLY_TO);
console.log("\nRemetente usado:", fromEmail);
console.log("Destino teste:", process.argv[2] || process.env.MAIL_REPLY_TO);
