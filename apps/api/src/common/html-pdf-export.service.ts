import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { existsSync } from "node:fs";
import type { Browser } from "puppeteer";

function findSystemChrome(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/lib/chromium/chromium-browser",
    "/snap/bin/chromium",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const c of candidates) {
    try {
      if (existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  return undefined;
}

@Injectable()
export class HtmlPdfExportService implements OnModuleDestroy {
  private readonly logger = new Logger(HtmlPdfExportService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  async onModuleDestroy() {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;
    if (this.launching) return this.launching;

    this.launching = (async () => {
      const puppeteer = await import("puppeteer");
      const executablePath = findSystemChrome();

      if (executablePath) {
        this.logger.log(`A iniciar Puppeteer com: ${executablePath}`);
      } else {
        this.logger.warn("Aviso: executável Chromium do sistema não detetado, a tentar resolver por defeito.");
      }

      const browser = await puppeteer.default.launch({
        headless: true,
        pipe: true,
        timeout: 30_000,
        ...(executablePath ? { executablePath } : {}),
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-zygote",
          "--single-process",
          "--disable-software-rasterizer",
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-default-apps",
          "--disable-sync",
          "--disable-translate",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-first-run",
          "--safebrowsing-disable-auto-update",
        ],
      });
      browser.on("disconnected", () => {
        this.browser = null;
      });
      this.browser = browser;
      this.launching = null;
      return browser;
    })();

    return this.launching;
  }

  async htmlToPdfBuffer(
    html: string,
    opts?: {
      margin?: { top?: string; right?: string; bottom?: string; left?: string };
      preferCSSPageSize?: boolean;
    },
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      page.setDefaultTimeout(15_000);
      page.setDefaultNavigationTimeout(15_000);
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        timeout: 15_000,
        preferCSSPageSize: opts?.preferCSSPageSize ?? false,
        margin: opts?.margin ?? { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
      });
      return Buffer.from(pdf);
    } catch (err) {
      this.logger.warn(
        `Falha ao gerar PDF: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.browser = null;
      throw err;
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}
