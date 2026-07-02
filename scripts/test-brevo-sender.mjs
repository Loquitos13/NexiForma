/** Teste rápido com remetente Gmail registado na Brevo */
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

const senderEmail = process.argv[2] || "bdiogo511@gmail.com";
const to = process.argv[3] || senderEmail;

const res = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "api-key": process.env.BREVO_API_KEY,
    "Content-Type": "application/json",
    accept: "application/json",
  },
  body: JSON.stringify({
    sender: { name: "NexiForma", email: senderEmail },
    to: [{ email: to }],
    subject: "NexiForma – teste remetente autorizado",
    textContent: `Teste com remetente ${senderEmail}`,
  }),
});

console.log("Status:", res.status);
console.log(await res.text());
