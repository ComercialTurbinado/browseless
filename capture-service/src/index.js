import express from "express";
import { openPage } from "./open.js";

const PORT = process.env.PORT || 4000;
const app = express();
app.use(express.json({ limit: "1mb" }));

/**
 * POST /open
 *
 * Abre a URL no browser. A página em si é que lê a animação,
 * captura cada frame e envia para o webhook.
 *
 * Body:
 *   - url (string): URL da página que faz o trabalho de frame + webhook
 *   - waitMs (number, opcional): tempo em ms para manter a página aberta (default: 30000)
 */
app.post("/open", async (req, res) => {
  const { url, waitMs = 30000 } = req.body;

  if (!url) {
    return res.status(400).json({
      error: "Missing required field: url",
      example: { url: "https://example.com/sua-pagina-com-animacao", waitMs: 30000 },
    });
  }

  try {
    await openPage({ url, waitMs });
    return res.json({ ok: true, url, waitMs });
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
