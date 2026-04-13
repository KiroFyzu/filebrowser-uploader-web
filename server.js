import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import uploadRouter from "./src/routes/upload.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "filebrowser-uploader" });
});

app.use("/api", uploadRouter);

app.use((err, _req, res, _next) => {
  if (err?.name === "MulterError" && err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      ok: false,
      message: "Ukuran file melebihi batas maksimal 100 MB per file.",
    });
  }

  if (err?.name === "MulterError") {
    return res.status(400).json({
      ok: false,
      message: err.message,
    });
  }

  const message = err?.message || "Terjadi error internal saat memproses upload.";
  return res.status(500).json({ ok: false, message });
});

const port = Number.parseInt(process.env.PORT || "3000", 10);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Uploader running on http://localhost:${port}`);
});
