import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { Browser } from "puppeteer";

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
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
      this.browser = browser;
      this.launching = null;
      return browser;
    })();

    return this.launching;
  }

  async htmlToPdfBuffer(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
      });
      return Buffer.from(pdf);
    } catch (err) {
      this.logger.warn(
        `Falha ao gerar PDF: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}
