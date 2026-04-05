import puppeteer from "puppeteer-core";

const BROWSERLESS_WS_URL = process.env.BROWSERLESS_WS_URL;
if (!BROWSERLESS_WS_URL) throw new Error("BROWSERLESS_WS_URL is required");

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const REDUCE_MEMORY_ARGS = [
  "--disk-cache-size=0",
  "--disable-application-cache",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-sync",
  "--metrics-recording-only",
];

/**
 * Modo captureFrames: usa CDP Page.startScreencast — captura nativa do Chrome,
 * sem html2canvas, sem memória extra, frames em JPEG 1080x1920 nativos.
 * A página só precisa setar window.__remotionReady = true quando estiver pronta.
 *
 * Modo padrão: aguarda window.__captureDone = true (página faz a captura).
 */
export async function openPage({
  url,
  timeoutMs = 900000,
  viewportWidth = 1920,
  viewportHeight = 1080,
  captureFrames = null,
}) {
  const sep = BROWSERLESS_WS_URL.includes("?") ? "&" : "?";
  const launch = JSON.stringify({ args: REDUCE_MEMORY_ARGS });
  const endpoint = `${BROWSERLESS_WS_URL}${sep}timeout=${timeoutMs}&launch=${encodeURIComponent(launch)}`;

  const browser = await puppeteer.connect({
    browserWSEndpoint: endpoint,
    protocolTimeout: timeoutMs + 60000,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(DESKTOP_USER_AGENT);
    await page.setViewport({ width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

    if (captureFrames) {
      const {
        fps = 8,
        durationMs = 30000,
        webhookFramesUrl,
        webhookDoneUrl,
        webhookMontarUrl,
        listingId,
        imobname = "",
        advertiserCode = "",
      } = captureFrames;

      // Aguarda animação pronta
      await page.waitForFunction("window.__remotionReady === true", { timeout: 90000 });
      console.log(`[screencast] animação pronta — iniciando captura ${durationMs}ms @ ${fps}fps`);

      // CDP screencast — captura nativa do Chrome, muito mais eficiente que screenshot loop
      const cdp = await page.target().createCDPSession();

      const collectedFrames = [];

      cdp.on("Page.screencastFrame", async ({ data, sessionId }) => {
        collectedFrames.push(data); // base64 JPEG já pronto
        // Ack imediato para Chrome continuar enviando
        cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
      });

      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 80,
        maxWidth: viewportWidth,
        maxHeight: viewportHeight,
        everyNthFrame: Math.max(1, Math.round(60 / fps)), // aproxima o fps desejado
      });

      // Aguarda duração da animação
      await new Promise((r) => setTimeout(r, durationMs + 500));

      await cdp.send("Page.stopScreencast").catch(() => {});

      console.log(`[screencast] ${collectedFrames.length} frames coletados — enviando ao webhook`);

      // Envia frames ao webhook sequencialmente (evita sobrecarga de rede)
      const totalFrames = collectedFrames.length;
      let framesSent = 0;

      for (let i = 0; i < totalFrames; i++) {
        const fn = i + 1;
        if (!webhookFramesUrl) break;
        try {
          await fetch(webhookFramesUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              frame_number: fn,
              total_frames: totalFrames,
              frame_name: `frame_${String(fn).padStart(4, "0")}.jpg`,
              image_base64: collectedFrames[i],
              listing_id: Number(listingId),
              imobname,
              advertiserCode,
              mime_type: "image/jpeg",
              fps,
              timestamp_ms: Math.round((i / totalFrames) * durationMs),
              render_source: "remotion",
            }),
          });
          framesSent++;
        } catch (e) {
          console.error(`[screencast] erro frame ${fn}:`, e.message);
        }
      }

      console.log(`[screencast] ${framesSent}/${totalFrames} frames enviados`);

      const done = {
        listing_id: Number(listingId),
        imobname,
        advertiserCode,
        frames_sent: framesSent,
        total_frames: totalFrames,
        status: "done",
        fps,
        duration_ms: durationMs,
        via: "remotion_capture",
        render_source: "remotion",
      };

      if (webhookDoneUrl)
        await fetch(webhookDoneUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(done),
        }).catch((e) => console.error("[screencast] webhookDone:", e.message));

      if (webhookMontarUrl)
        await fetch(webhookMontarUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...done, action: "montar_mp4" }),
        }).catch((e) => console.error("[screencast] webhookMontar:", e.message));

      return;
    }

    // Modo padrão: página captura os próprios frames e sinaliza quando termina
    await page.waitForFunction("window.__captureDone === true", { timeout: timeoutMs });
  } finally {
    await browser.close();
  }
}
