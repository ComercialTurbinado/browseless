import puppeteer from "puppeteer-core";

const BROWSERLESS_WS_URL = process.env.BROWSERLESS_WS_URL;

if (!BROWSERLESS_WS_URL) {
  throw new Error("BROWSERLESS_WS_URL is required");
}

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Abre a URL no browser e só encerra quando a página sinalizar que terminou
 * (window.__captureDone = true), ou após timeoutMs (fallback).
 * A página é responsável por capturar os frames, enviar ao webhook e então setar
 * window.__captureDone = true.
 */
export async function openPage({ url, timeoutMs = 900000 }) {
  const sep = BROWSERLESS_WS_URL.includes("?") ? "&" : "?";
  const endpoint = `${BROWSERLESS_WS_URL}${sep}timeout=${timeoutMs}`;
  const browser = await puppeteer.connect({
    browserWSEndpoint: endpoint,
    protocolTimeout: timeoutMs + 60000,
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(DESKTOP_USER_AGENT);
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    });

    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

    await page.waitForFunction(
      "window.__captureDone === true",
      { timeout: timeoutMs }
    );
  } finally {
    await browser.close();
  }
}
