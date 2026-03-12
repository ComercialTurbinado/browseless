import puppeteer from "puppeteer-core";

const BROWSERLESS_WS_URL = process.env.BROWSERLESS_WS_URL;

if (!BROWSERLESS_WS_URL) {
  throw new Error("BROWSERLESS_WS_URL is required");
}

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Abre a URL no browser e mantém a página aberta pelo tempo indicado.
 * A página em si é responsável por ler a animação, capturar os frames e enviar ao webhook.
 * User-Agent e viewport realistas ajudam CDNs/servidores externos a liberar imagens.
 */
export async function openPage({ url, waitMs = 30000 }) {
  const browser = await puppeteer.connect({
    browserWSEndpoint: BROWSERLESS_WS_URL,
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
    await new Promise((r) => setTimeout(r, waitMs));
  } finally {
    await browser.close();
  }
}
