/**
 * Gera pacote ZIP SCORM 1.2 (modelo mais comum) para upload no NexiForma.
 *
 *   node scripts/build-scorm-demo-package.mjs
 *
 * Saída: packages/scorm-demo/dist/nexiforma-scorm-12-demo.zip
 */
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "packages", "scorm-demo");
const outDir = join(srcDir, "dist");
const staging = join(outDir, "_staging");
const outZip = join(outDir, "nexiforma-scorm-12-demo.zip");
const files = ["imsmanifest.xml", "index.html"];

mkdirSync(outDir, { recursive: true });
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

for (const name of files) {
  writeFileSync(join(staging, name), readFileSync(join(srcDir, name)));
}

rmSync(outZip, { force: true });
if (process.platform === "win32") {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${staging}\\*' -DestinationPath '${outZip}' -Force"`,
    { stdio: "inherit" },
  );
} else {
  execSync(`cd "${staging}" && zip -r "${outZip}" .`, { stdio: "inherit" });
}
rmSync(staging, { recursive: true, force: true });

console.log(`Pacote SCORM 1.2 criado: ${outZip}`);
console.log("Carrega este ZIP em Configuração do curso → módulo SCORM → Carregar pacote.");
