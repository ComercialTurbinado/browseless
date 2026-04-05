import puppeteer from "puppeteer-core";

const BROWSERLESS_WS_URL = process.env.BROWSERLESS_WS_URL;

if (!BROWSERLESS_WS_URL) {
  throw new Error("BROWSERLESS_WS_URL is required");
}

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
 * Abre a URL no browser.
 *
 * Modo padrão (captureFrames = null):
 *   Aguarda window.__captureDone === true (a página captura os frames e envia ao webhook).
 *
 * Modo captureFrames:
 *   O Puppeteer tira screenshots nativos (page.screenshot) durante a reprodução da animação.
 *   A página só precisa setar window.__remotionReady = true quando estiver pronta.
 *   Muito mais eficiente — sem html2canvas, sem carga no browser.
 *
 *   captureFrames = {
 *     fps, durationMs, webhookFramesUrl, webhookDoneUrl, webhookMontarUrl,
 *     listingId, imobname, advertiserCode
 *   }
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

      // Aguarda a página sinalizar que está pronta (preloader terminou, animação iniciou)
      await page.waitForFunction("window.__remotionReady === true", { timeout: 90000 });

      const frameIntervalMs = Math.round(1000 / fps);
      const targetFrames = Math.ceil((durationMs / 1000) * fps);
      const captureStart = Date.now();
      let frameNum = 0;

      console.log(`[captureFrames] início: ${targetFrames} frames alvo @ ${fps}fps, ${durationMs}ms`);

      while (Date.now() - captureStart < durationMs) {
        const t0 = Date.now();

        // Screenshot nativo do Puppeteer — rápido e sem carga no browser
        const screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
        frameNum++;

        const fn = frameNum;
        const timestampMs = t0 - captureStart;

        if (webhookFramesUrl) {
          const b64 = screenshot.toString("base64");
          // POST sem await para não bloquear o loop de captura
          fetch(webhookFramesUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              frame_number: fn,
              total_frames: targetFrames,
              frame_name: `frame_${String(fn).padStart(4, "0")}.jpg`,
              image_base64: b64,
              listing_id: Number(listingId),
              imobname,
              advertiserCode,
              mime_type: "image/jpeg",
              fps,
              timestamp_ms: timestampMs,
              render_source: "remotion",
            }),
          }).catch((e) => console.error("[captureFrames] frame", fn, e.message));
        }

        // Pace para o fps alvo
        const elapsed = Date.now() - t0;
        const wait = frameIntervalMs - elapsed;
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }

      const actualDuration = Date.now() - captureStart;
      const actualFps = Math.round((frameNum / actualDuration) * 1000 * 10) / 10;
      console.log(`[captureFrames] fim: ${frameNum} frames capturados, fps real ~${actualFps}`);

      // Aguarda POSTs em flight terminarem
      await new Promise((r) => setTimeout(r, 3000));

      const done = {
        listing_id: Number(listingId),
        imobname,
        advertiserCode,
        frames_sent: frameNum,
        total_frames: frameNum,
        status: "done",
        fps: actualFps,
        duration_ms: durationMs,
        via: "remotion_capture",
        render_source: "remotion",
      };

      if (webhookDoneUrl)
        await fetch(webhookDoneUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(done),
        }).catch((e) => console.error("[captureFrames] webhookDone", e.message));

      if (webhookMontarUrl)
        await fetch(webhookMontarUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...done, action: "montar_mp4" }),
        }).catch((e) => console.error("[captureFrames] webhookMontar", e.message));

      return;
    }

    // Modo padrão: a página captura os frames e sinaliza quando termina
    await page.waitForFunction("window.__captureDone === true", { timeout: timeoutMs });
  } finally {
    await browser.close();
  }
}
