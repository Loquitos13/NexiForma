import https from "node:https";

const TLS_MIN_VERSION = "TLSv1.2" as const;

export function postSigoSoapRequest(
  endpoint: string,
  soapAction: string,
  body: string,
  options: { timeoutMs: number },
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "POST",
        minVersion: TLS_MIN_VERSION,
        maxVersion: "TLSv1.3",
        rejectUnauthorized: true,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: soapAction,
          "Content-Length": Buffer.byteLength(body, "utf8"),
        },
        timeout: options.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout na ligação SOAP ao SIGO."));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export function fetchSigoWsdl(
  wsdlUrl: string,
  options: { timeoutMs: number },
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(wsdlUrl);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "GET",
        minVersion: TLS_MIN_VERSION,
        maxVersion: "TLSv1.3",
        rejectUnauthorized: true,
        headers: { Accept: "text/xml, application/wsdl+xml, */*" },
        timeout: options.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout ao obter WSDL SIGO."));
    });
    req.on("error", reject);
    req.end();
  });
}
