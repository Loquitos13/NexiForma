export const RGPD_EXPORT_FORMATS = ["json", "csv", "txt"] as const;
export type RgpdExportFormat = (typeof RGPD_EXPORT_FORMATS)[number];

export function parseRgpdExportFormat(raw: unknown): RgpdExportFormat {
  const v = String(raw ?? "json").trim().toLowerCase();
  if ((RGPD_EXPORT_FORMATS as readonly string[]).includes(v)) {
    return v as RgpdExportFormat;
  }
  return "json";
}

export function serializeRgpdExport(
  payload: unknown,
  format: RgpdExportFormat,
): { body: Buffer; contentType: string; extension: string } {
  if (format === "csv") {
    const rows = flattenToRows(payload);
    const csv = rowsToCsv(rows);
    return {
      body: Buffer.from(csv, "utf8"),
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
    };
  }

  if (format === "txt") {
    const text = JSON.stringify(payload, null, 2);
    return {
      body: Buffer.from(text, "utf8"),
      contentType: "text/plain; charset=utf-8",
      extension: "txt",
    };
  }

  return {
    body: Buffer.from(JSON.stringify(payload, null, 2), "utf8"),
    contentType: "application/json; charset=utf-8",
    extension: "json",
  };
}

function flattenToRows(value: unknown, prefix = ""): Array<{ chave: string; valor: string }> {
  if (value === null || value === undefined) {
    return [{ chave: prefix || "valor", valor: "" }];
  }
  if (typeof value !== "object") {
    return [{ chave: prefix || "valor", valor: String(value) }];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [{ chave: prefix || "lista", valor: "[]" }];
    }
    return value.flatMap((item, i) =>
      flattenToRows(item, prefix ? `${prefix}[${i}]` : `[${i}]`),
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return [{ chave: prefix || "objeto", valor: "{}" }];
  }
  return entries.flatMap(([k, v]) => flattenToRows(v, prefix ? `${prefix}.${k}` : k));
}

function rowsToCsv(rows: Array<{ chave: string; valor: string }>): string {
  const escape = (s: string) => {
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = ["chave,valor", ...rows.map((r) => `${escape(r.chave)},${escape(r.valor)}`)];
  return `${lines.join("\n")}\n`;
}
