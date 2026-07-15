/**
 * Arranca Next.js com WEB_PORT do `.env` da raiz (defeito 3000).
 * Evita confundir com API_PORT - login/BFF vivem sempre na Web, não na API.
 */
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(scriptDir, "..", ".env");
const webDir = resolve(scriptDir, "..", "apps", "web");

if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
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
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const webPort = Number(process.env.WEB_PORT ?? process.env.PORT ?? "3000");
const apiPort = Number(process.env.API_PORT ?? "4000");
const bindHost = process.env.DEV_BIND_HOST ?? "0.0.0.0";
const lanIp = process.env.DEV_LAN_IP?.trim() || null;
const appUrl = (process.env.APP_PUBLIC_URL ?? `http://localhost:${webPort}`).replace(/\/$/, "");

function isPortFree(port) {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.once("error", () => resolvePort(false));
    server.once("listening", () => {
      server.close(() => resolvePort(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

const free = await isPortFree(webPort);
if (!free) {
  console.error(
    `\n[NexiForma] Porta ${webPort} já está em uso - a Web não arrancou.\n` +
      `  • Feche o processo anterior (ex.: outro \`next dev\`)\n` +
      `  • Ou defina WEB_PORT=3002 no .env e APP_PUBLIC_URL=http://localhost:3002\n` +
      `  • Login e /api/auth/* só funcionam em ${appUrl} - não abra a API (:${apiPort}) no browser.\n`,
  );
  process.exit(1);
}

const extraArgs = process.argv.includes("--")
  ? process.argv.slice(process.argv.indexOf("--") + 1)
  : [];

console.log(`\n[NexiForma Web]  ${appUrl}  (login, portal, BFF /api/auth/*)`);
if (lanIp) {
  console.log(`[NexiForma Web]  http://${lanIp}:${webPort}  (rede local)`);
}
console.log(`[NexiForma Web]  bind ${bindHost}:${webPort}`);
console.log(`[NexiForma API]  http://127.0.0.1:${apiPort}/v1  (REST - BFF server-side)\n`);

const child = spawn(
  "npx",
  ["next", "dev", "--port", String(webPort), "--hostname", bindHost, ...extraArgs],
  {
  cwd: webDir,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: String(webPort) },
});

child.on("exit", (code) => process.exit(code ?? 0));
