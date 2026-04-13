import express from "express";
import multer from "multer";
import { config } from "../config.js";
import { uploadAndCreateShare } from "../services/filebrowser.js";

const router = express.Router();

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeBytes,
    files: config.maxFiles,
  },
});

router.get("/client-config", (_req, res) => {
  return res.json({
    ok: true,
    waBot: {
      enabled: config.waBot.enabled,
      number: config.waBot.number,
    },
  });
});

router.post("/upload", uploader.any(), async (req, res, next) => {
  try {
    const mode = String(req.body.mode || "single").toLowerCase();
    const files = Array.isArray(req.files) ? req.files : [];

    if (!files.length) {
      return res.status(400).json({
        ok: false,
        message: "Tidak ada file yang dikirim.",
      });
    }

    if (mode === "single" && files.length !== 1) {
      return res.status(400).json({
        ok: false,
        message: "Mode single hanya boleh 1 file.",
      });
    }

    const uploads = mode === "single" ? [files[0]] : files;
    const settled = await Promise.allSettled(uploads.map((file) => uploadAndCreateShare(file)));

    const uploaded = [];
    const failed = [];

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        uploaded.push(result.value);
      } else {
        failed.push({
          fileName: uploads[index].originalname,
          message: result.reason?.message || "Upload gagal.",
        });
      }
    });

    const statusCode = failed.length === 0 ? 200 : uploaded.length > 0 ? 207 : 500;

    return res.status(statusCode).json({
      ok: uploaded.length > 0,
      mode,
      count: {
        total: uploads.length,
        uploaded: uploaded.length,
        failed: failed.length,
      },
      uploaded,
      failed,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
