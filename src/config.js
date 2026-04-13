import dotenv from "dotenv";

dotenv.config();

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeBaseURL(baseURL) {
  return (baseURL || "").replace(/\/+$/, "");
}

function normalizeUploadDir(uploadDir) {
  if (!uploadDir) {
    return "/uploads";
  }
  const withLeadingSlash = uploadDir.startsWith("/") ? uploadDir : `/${uploadDir}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/uploads";
}

function normalizeWhatsAppNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

const required = [
  "FILEBROWSER_BASE_URL",
  "FILEBROWSER_USERNAME",
  "FILEBROWSER_PASSWORD",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const maxFileSizeMB = parsePositiveInteger(process.env.MAX_FILE_SIZE_MB, 100);

export const config = {
  fileBrowser: {
    baseURL: normalizeBaseURL(process.env.FILEBROWSER_BASE_URL),
    username: process.env.FILEBROWSER_USERNAME,
    password: process.env.FILEBROWSER_PASSWORD,
  },
  uploadDir: normalizeUploadDir(process.env.FILEBROWSER_UPLOAD_DIR),
  maxFileSizeMB,
  maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,
  maxFiles: parsePositiveInteger(process.env.MAX_FILES, 20),
  waBot: {
    number: normalizeWhatsAppNumber(process.env.WA_BOT_NUMBER),
  },
};

config.waBot.enabled = Boolean(config.waBot.number);
