import { readFileSync } from "node:fs";
import https from "node:https";

export type AtTlsConfig = {
  pfxPath?: string | null;
  pfxPassphrase?: string | null;
  certPath?: string | null;
  keyPath?: string | null;
  caPath?: string | null;
};

export function loadAtTlsMaterial(config: AtTlsConfig): https.AgentOptions | null {
  if (config.pfxPath) {
    return {
      pfx: readFileSync(config.pfxPath),
      passphrase: config.pfxPassphrase ?? "",
      rejectUnauthorized: true,
      ...(config.caPath ? { ca: readFileSync(config.caPath) } : {}),
    };
  }
  if (config.certPath && config.keyPath) {
    return {
      cert: readFileSync(config.certPath),
      key: readFileSync(config.keyPath),
      rejectUnauthorized: true,
      ...(config.caPath ? { ca: readFileSync(config.caPath) } : {}),
    };
  }
  return null;
}

export function postAtSoapRequest(
  endpoint: string,
  soapAction: string,
  body: string,
  options: { timeoutMs: number; tls?: https.AgentOptions | null },
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "POST",
        ...(options.tls ?? {}),
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: soapAction,
          "Content-Length": Buffer.byteLength(body, "utf8"),
        },
        timeout: options.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("Timeout na ligação ao webservice AT."));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
