/**
 * Auditoria estática de acessibilidade (imagens, landmarks, skip link).
 * Executar: node scripts/a11y-audit.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const webRoot = join(root, "apps", "web");
const issues = [];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, acc);
    } else if (/\.(tsx|jsx)$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

function auditFile(path) {
  const rel = relative(root, path);
  const src = readFileSync(path, "utf8");

  const imgTags = [...src.matchAll(/<img\b[^>]*>/gi)];
  for (const m of imgTags) {
    const tag = m[0];
    if (!/\balt\s*=/.test(tag)) {
      issues.push({ rel, rule: "img-alt", message: `<img> sem atributo alt`, snippet: tag.slice(0, 80) });
    } else if (/alt\s*=\s*["']\s*["']/.test(tag) && !/\baria-hidden\b/.test(tag)) {
      issues.push({
        rel,
        rule: "img-empty-alt",
        message: `alt vazio sem aria-hidden (decorativa?)`,
        snippet: tag.slice(0, 80),
      });
    }
  }

  const nextImages = [...src.matchAll(/<Image\b[^>]*\/?>/gi)];
  for (const m of nextImages) {
    const tag = m[0];
    if (!/\balt\s*=/.test(tag)) {
      issues.push({ rel, rule: "next-image-alt", message: `<Image> sem alt`, snippet: tag.slice(0, 80) });
    }
  }
}

for (const file of walk(webRoot)) {
  auditFile(file);
}

const layoutChecks = [
  join(webRoot, "components", "portal", "backoffice-shell.tsx"),
  join(webRoot, "components", "portal", "formando-shell.tsx"),
  join(webRoot, "app", "plataforma", "layout.tsx"),
];

for (const file of layoutChecks) {
  if (readFileSync(file, "utf8").includes('id="main-content"')) {
    console.log(`✓ Landmark #main-content em ${relative(root, file)}`);
  } else {
    issues.push({
      rel: relative(root, file),
      rule: "main-landmark",
      message: "Falta id=main-content",
    });
  }
}

const skip = join(webRoot, "components", "ui", "skip-link.tsx");
if (statSync(skip).isFile()) {
  console.log("✓ SkipLink componente existe");
}

console.log(`\nFicheiros TSX auditados em apps/web\n`);

if (!issues.length) {
  console.log("Nenhum problema de imagem/alt detectado.");
  process.exit(0);
}

console.log(`${issues.length} problema(s):\n`);
for (const i of issues) {
  console.log(`- [${i.rule}] ${i.rel}: ${i.message}`);
  if (i.snippet) console.log(`  ${i.snippet}`);
}
process.exit(1);
