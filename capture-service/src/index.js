import express from "express";
import { openPage } from "./open.js";

const PORT = process.env.PORT || 4000;
const app = express();
app.use(express.json({ limit: "1mb" }));

/**
 * POST /open
 *
 * Abre a URL no browser. Só encerra quando a página setar window.__captureDone = true
 * (após enviar os prints ao webhook), ou após timeoutMs.
 *
 * Body:
 *   - url (string): URL da página que captura os frames e envia ao webhook
 *   - timeoutMs (number, opcional): tempo máximo de espera em ms se a página não sinalizar (default: 300000 = 5 min)
 */
app.post("/open", async (req, res) => {
  const { url, timeoutMs = 300000 } = req.body;

  if (!url) {
    return res.status(400).json({
      error: "Missing required field: url",
      example: { url: "https://example.com/sua-pagina", timeoutMs: 300000 },
    });
  }

  try {
    await openPage({ url, timeoutMs });
    return res.json({ ok: true, url });
  } catch (err) {
    console.error("Open page error:", err);
    return res.status(500).json({
      error: "Failed to open page",
      message: err.message,
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    browserlessWsUrl: process.env.BROWSERLESS_WS_URL ? "configured" : "missing",
  });
});

app.listen(PORT, () => {
  console.log(`Capture service listening on http://0.0.0.0:${PORT}`);
  console.log("POST /open — open URL in browser (page does frame capture + webhook)");
});
