import path from "node:path";
import { FileBrowserSDK } from "filebrowser-sdk";
import { config } from "../config.js";

let sdkInstance = null;
let ensuredUploadDirectory = false;

function buildUniqueFileName(originalName) {
  const extension = path.extname(originalName || "");
  const rawName = path.basename(originalName || "file", extension);
  const safeName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "file";

  const time = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${safeName}-${time}-${random}${extension.toLowerCase()}`;
}

function buildRemotePath(fileName) {
  return `${config.uploadDir}/${fileName}`.replace(/\/+/g, "/");
}

function encodeRemotePath(filePath) {
  const normalized = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return normalized
    .split("/")
    .map((segment, index) => (index === 0 ? "" : encodeURIComponent(segment)))
    .join("/");
}

function buildDirectDownloadURL(hash) {
  const baseURL = config.fileBrowser.baseURL.replace(/\/$/, "");
  return `${baseURL}/api/public/dl/${hash}?inline=true`;
}

async function createShareViaAPI(sdk, remotePath) {
  const token = sdk.auth.getToken();
  const shareEndpoint = `${config.fileBrowser.baseURL}/api/share${encodeRemotePath(remotePath)}`;

  const response = await fetch(shareEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth": token || "",
    },
    body: "{}",
  });

  if (!response.ok) {
    const bodyText = await response.text();
    const error = new Error(bodyText || `Failed creating share (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function getSDK(forceRefresh = false) {
  if (!sdkInstance || forceRefresh) {
    sdkInstance = await FileBrowserSDK.create({
      baseURL: config.fileBrowser.baseURL,
      username: config.fileBrowser.username,
      password: config.fileBrowser.password,
    });
  }
  return sdkInstance;
}

async function ensureUploadDirectory() {
  if (ensuredUploadDirectory) {
    return;
  }

  const sdk = await getSDK();
  try {
    await sdk.files.mkdir(config.uploadDir);
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    const status = error?.status || error?.response?.status;
    const alreadyExists = status === 409 || message.includes("exist");
    if (!alreadyExists) {
      throw error;
    }
  }

  ensuredUploadDirectory = true;
}

async function uploadAndShareOnce(file) {
  await ensureUploadDirectory();

  const sdk = await getSDK();
  const storedName = buildUniqueFileName(file.originalname);
  const remotePath = buildRemotePath(storedName);

  await sdk.files.upload(remotePath, file.buffer, { override: false });
  const share = await createShareViaAPI(sdk, remotePath);
  const shareURL = buildDirectDownloadURL(share.hash);

  return {
    originalName: file.originalname,
    storedName,
    mimetype: file.mimetype,
    size: file.size,
    path: remotePath,
    shareHash: share.hash,
    shareURL,
  };
}

export async function uploadAndCreateShare(file) {
  try {
    return await uploadAndShareOnce(file);
  } catch (error) {
    const status = error?.status || error?.response?.status;
    if (status !== 401) {
      throw error;
    }

    sdkInstance = null;
    ensuredUploadDirectory = false;
    return uploadAndShareOnce(file);
  }
}
