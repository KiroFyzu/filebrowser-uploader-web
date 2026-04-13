const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const selectedList = document.getElementById("selectedList");
const resultList = document.getElementById("resultList");
const statusEl = document.getElementById("status");
const uploadBtn = document.getElementById("uploadBtn");
const clearBtn = document.getElementById("clearBtn");
const uploadLoader = document.getElementById("uploadLoader");

const state = {
  mode: "single",
  files: [],
  isUploading: false,
  waBot: {
    enabled: false,
    number: "",
  },
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.dataset.type = type;
}

function updateButtonState() {
  uploadBtn.disabled = state.isUploading || state.files.length === 0;
}

function setLoading(isLoading) {
  uploadLoader.hidden = !isLoading;
  dropzone.style.pointerEvents = isLoading ? "none" : "auto";
}

function normalizeWhatsAppNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function setWaBotConfig(value) {
  const number = normalizeWhatsAppNumber(value);
  state.waBot = {
    enabled: Boolean(number),
    number,
  };
}

function buildWhatsAppLink(shareURL) {
  if (!state.waBot.enabled || !shareURL) {
    return "";
  }

  const message = `.statushd ${shareURL}`;
  return `https://wa.me/${state.waBot.number}?text=${encodeURIComponent(message)}`;
}

async function loadClientConfig() {
  try {
    const response = await fetch("/api/client-config");
    if (!response.ok) {
      return;
    }

    const payload = await response.json().catch(() => null);
    setWaBotConfig(payload?.waBot?.number);

    if (!state.waBot.enabled) {
      setStatus("Nomor WA bot belum dikonfigurasi. Upload tetap bisa, tombol Direct WA belum tersedia.", "warn");
    }
  } catch {
    // Ignore config fetch errors to keep upload flow usable.
  }
}

function syncInputMode() {
  fileInput.multiple = state.mode === "multi";
}

function dedupeFiles(files) {
  const map = new Map();
  files.forEach((file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    map.set(key, file);
  });
  return Array.from(map.values());
}

function addFiles(incoming) {
  const nextFiles = Array.from(incoming || []);
  if (!nextFiles.length) {
    return;
  }

  if (state.mode === "single") {
    state.files = [nextFiles[0]];
  } else {
    state.files = dedupeFiles([...state.files, ...nextFiles]);
  }

  renderSelectedFiles();
  updateButtonState();
}

function renderSelectedFiles() {
  if (!state.files.length) {
    selectedList.innerHTML = '<p class="empty">Belum ada file dipilih.</p>';
    return;
  }

  selectedList.innerHTML = state.files
    .map(
      (file) => `
      <article class="file-item">
        <p class="name">${file.name}</p>
        <p class="meta">${formatSize(file.size)}</p>
      </article>
    `,
    )
    .join("");
}

function renderResults(uploaded = [], failed = []) {
  const blocks = [];

  uploaded.forEach((item) => {
    const waLink = buildWhatsAppLink(item.shareURL);
    blocks.push(`
      <article class="result success">
        <p class="title">${item.originalName}</p>
        <a href="${item.shareURL}" target="_blank" rel="noreferrer">${item.shareURL}</a>
        <div class="result-actions">
          <button type="button" class="copy-btn" data-link="${item.shareURL}">Copy Link</button>
          ${
            waLink
              ? `<button type="button" class="wa-btn" data-wa-link="${waLink}">Direct ke WA Bot</button>`
              : ""
          }
        </div>
      </article>
    `);
  });

  failed.forEach((item) => {
    blocks.push(`
      <article class="result error">
        <p class="title">${item.fileName || "Unknown file"}</p>
        <p class="error-text">${item.message || "Upload gagal"}</p>
      </article>
    `);
  });

  resultList.innerHTML = blocks.length ? blocks.join("") : '<p class="empty">Belum ada hasil upload.</p>';
}

async function uploadFiles() {
  if (!state.files.length || state.isUploading) {
    return;
  }

  state.isUploading = true;
  updateButtonState();
  setLoading(true);
  setStatus("Sedang upload file...", "loading");

  try {
    const formData = new FormData();
    formData.append("mode", state.mode);
    state.files.forEach((file) => {
      formData.append("files", file, file.name);
    });

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok && response.status !== 207) {
      throw new Error(payload.message || "Upload gagal.");
    }

    await clientConfigReady;
    renderResults(payload.uploaded, payload.failed);

    if (payload.count?.failed > 0) {
      setStatus(
        `Upload selesai sebagian: ${payload.count.uploaded} sukses, ${payload.count.failed} gagal.`,
        "warn",
      );
    } else {
      setStatus(`Upload berhasil: ${payload.count?.uploaded || 0} file.`, "ok");
      state.files = [];
      renderSelectedFiles();
    }
  } catch (error) {
    setStatus(error.message || "Upload gagal.", "error");
  } finally {
    state.isUploading = false;
    updateButtonState();
    setLoading(false);
  }
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("drag-active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("drag-active");
  });
});

dropzone.addEventListener("drop", (event) => {
  addFiles(event.dataTransfer?.files);
});

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    state.mode = input.value;
    syncInputMode();
    state.files = [];
    renderSelectedFiles();
    updateButtonState();
    setStatus(`Mode ${state.mode} dipilih.`, "");
  });
});

clearBtn.addEventListener("click", () => {
  state.files = [];
  renderSelectedFiles();
  updateButtonState();
  setStatus("Daftar file dibersihkan.", "");
});

uploadBtn.addEventListener("click", uploadFiles);

resultList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (button.classList.contains("wa-btn")) {
    const waLink = button.dataset.waLink;
    if (!waLink) {
      return;
    }

    window.open(waLink, "_blank", "noopener,noreferrer");
    setStatus("Membuka WhatsApp bot...", "ok");
    return;
  }

  if (!button.classList.contains("copy-btn")) {
    return;
  }

  const link = button.dataset.link;
  if (!link) {
    return;
  }

  try {
    await navigator.clipboard.writeText(link);
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = "Copy Link";
    }, 1200);
  } catch {
    setStatus("Gagal copy link otomatis. Copy manual dari hasil.", "warn");
  }
});

const clientConfigReady = loadClientConfig();

syncInputMode();
renderSelectedFiles();
renderResults();
updateButtonState();
setLoading(false);
