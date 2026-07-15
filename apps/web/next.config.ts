import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildContentSecurityPolicy,
  productionOnlyHeaders,
  TRANSPORT_SECURITY_HEADERS,
} from "./lib/server/transport-security";

/** Next.js só lê `.env` em apps/web – reutilizar o da raiz do monorepo. */
function loadRootEnv() {
  const rootEnv = resolve(__dirname, "../../.env");
  if (!existsSync(rootEnv)) return;
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

loadRootEnv();

const extraDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@nexiforma/shared"],
  output: "standalone",
  async headers() {
    const securityHeaders = [
      ...TRANSPORT_SECURITY_HEADERS,
      ...productionOnlyHeaders(),
      {
        key: "Content-Security-Policy",
        value: buildContentSecurityPolicy(),
      },
    ];
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/portal/crm/propostas",
        destination: "/portal/propostas",
        permanent: true,
      },
      {
        source: "/portal/crm/propostas/:id",
        destination: "/portal/propostas/:id",
        permanent: true,
      },
    ];
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@nexiforma/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
    };
    return config;
  },
  // Acesso via IP Docker/WSL (ex.: 172.18.48.1) – evita aviso/bloqueio de /_next/*
  allowedDevOrigins: ["172.18.48.1", "127.0.0.1", ...extraDevOrigins],
};

export default nextConfig;
