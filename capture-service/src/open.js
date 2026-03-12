import puppeteer from "puppeteer-core";

const BROWSERLESS_WS_URL = process.env.BROWSERLESS_WS_URL;

if (!BROWSERLESS_WS_URL) {
  throw new Error("BROWSERLESS_WS_URL is required");
}

/**
 * Abre a URL no browser e mantém a página aberta pelo tempo indicado.
 * A página em si é responsável por ler a animação, capturar os frames e enviar ao webhook.
 */
export async function openPage({ url, waitMs = 30000 }) {
  const browser = await puppeteer.connect({
    browserWSEndpoint: BROWSERLESS_WS_URL,
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, waitMs));
  } finally {
    await browser.close();
  }
}
