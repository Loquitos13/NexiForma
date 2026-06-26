/** Extrai `filename` de `Content-Disposition: attachment; filename="..."`. */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const quoted = /filename\*=UTF-8''([^;\s]+)|filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) {
    try {
      return decodeURIComponent(quoted[1]);
    } catch {
      return quoted[1];
    }
  }
  if (quoted?.[2]) return quoted[2];
  const plain = /filename=([^;\s]+)/i.exec(header);
  return plain?.[1]?.replace(/"/g, "") ?? null;
}

/** Dispara download no browser a partir de uma `Response` fetch (BFF). */
export async function downloadResponseAsFile(
  res: Response,
  fallbackFilename: string,
): Promise<void> {
  const blob = await res.blob();
  const name =
    filenameFromContentDisposition(res.headers.get("content-disposition")) ??
    fallbackFilename;
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Export local (object → JSON) quando já tens os dados em memória. */
export function downloadJsonObject(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.endsWith(".json") ? filename : `${filename}.json`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
