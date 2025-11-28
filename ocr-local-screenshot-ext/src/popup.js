// Privacy: Screenshots and OCR text exist in memory only, never persisted
// Privacy: No logging of OCR text content or screenshot data

const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const screenshotBtn = document.getElementById("screenshotBtn");
const regionBtn = document.getElementById("regionBtn");
const copyBtn = document.getElementById("copyBtn");
const cancelBtn = document.getElementById("cancelBtn");
const progressTrack = document.getElementById("progressTrack");
const progressIndicator = document.getElementById("progressIndicator");

const { createWorker } = Tesseract;

// State variables
let workerPromise = null;
let currentWorker = null;
let isProcessing = false;

// Constants for image scaling
const MAX_PIXELS = 2000000; // ~1080p
const MAX_DIMENSION = 2000;

function setProcessing(processing) {
  isProcessing = processing;
  if (screenshotBtn) screenshotBtn.disabled = processing;
  if (regionBtn) regionBtn.disabled = processing;
  // We might want to keep copy enabled if there is previous text, but disabling for now to prevent confusion
  // Actually, copy should probably remain enabled if there is text.
  // if (copyBtn) copyBtn.disabled = processing;
  if (cancelBtn) cancelBtn.style.display = processing ? "flex" : "none";
}

function updateStatus(msg, progress = null) {
  if (statusEl) statusEl.textContent = msg;

  if (progressTrack && progressIndicator) {
    if (progress !== null) {
      progressTrack.classList.add("active");
      progressIndicator.classList.remove("indeterminate");
      progressIndicator.style.width = `${progress * 100}%`;
    } else if (msg.startsWith("Done") || msg.includes("Error") || msg === "Cancelled") {
      // Keep it visible for a moment then hide
      setTimeout(() => {
        progressTrack.classList.remove("active");
        progressIndicator.style.width = "0%";
      }, 1500);
    } else {
      // Indeterminate state for loading/initializing
      progressTrack.classList.add("active");
      progressIndicator.classList.add("indeterminate");
      progressIndicator.style.width = "50%"; // Trigger css animation
    }
  }
  console.log(msg);
}

function getWorker() {
  if (workerPromise) return workerPromise;

  const worker = createWorker({
    workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
    corePath: chrome.runtime.getURL("vendor/tesseract/tesseract-core-simd.wasm.js"),
    langPath: chrome.runtime.getURL("vendor/tessdata"),
    logger: (m) => {
      if (m.status) {
        if (typeof m.progress === "number") {
          updateStatus(`${m.status} ${(m.progress * 100).toFixed(0)}%`, m.progress);
        } else {
          updateStatus(m.status);
        }
      }
    },
  });

  workerPromise = (async () => {
    updateStatus("Loading OCR engine...");
    await worker.load();
    updateStatus("Loading language data...");
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    currentWorker = worker;
    updateStatus("Ready");
    return worker;
  })();

  return workerPromise;
}

// Cancellation support
async function cancelOcr() {
  if (currentWorker && isProcessing) {
    try {
      await currentWorker.terminate();
    } catch (err) {
      // Ignore termination errors
    }
    workerPromise = null;
    currentWorker = null;
    setProcessing(false);
    updateStatus("Cancelled");
  }
}

// Copy to clipboard helper
async function copyToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Clipboard error:", err);
    return false;
  }
}

// Convert data URL to Blob without using fetch (clearer that no network is involved)
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Scale image if it exceeds size limits (for performance)
function scaleImageIfNeeded(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const pixels = width * height;

      // Check if scaling is needed
      if (pixels <= MAX_PIXELS && width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve({ dataUrl, scaled: false });
        return;
      }

      // Calculate scale factor
      let scale = 1;
      if (pixels > MAX_PIXELS) {
        scale = Math.sqrt(MAX_PIXELS / pixels);
      }
      if (width * scale > MAX_DIMENSION) {
        scale = MAX_DIMENSION / width;
      }
      if (height * scale > MAX_DIMENSION) {
        scale = MAX_DIMENSION / height;
      }

      const newWidth = Math.floor(width * scale);
      const newHeight = Math.floor(height * scale);

      // Scale on canvas
      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      resolve({ dataUrl: canvas.toDataURL("image/png"), scaled: true });
    };
    img.onerror = () => resolve({ dataUrl, scaled: false });
    img.src = dataUrl;
  });
}

// OCR helper
async function runOcrOnFile(file) {
  try {
    setProcessing(true);
    const worker = await getWorker();
    updateStatus("Recognizing...");
    const { data } = await worker.recognize(file);
    const text = data.text || "";
    outputEl.value = text;

    // Auto-copy to clipboard and show result
    if (text.trim()) {
      const copied = await copyToClipboard(text);
      const charCount = text.length;
      const wordCount = text.trim().split(/\s+/).length;
      if (copied) {
        updateStatus(`Done - ${wordCount} words, ${charCount} chars (copied to clipboard)`);
      } else {
        updateStatus(`Done - ${wordCount} words, ${charCount} chars`);
      }
    } else {
      updateStatus("Done - no text found");
    }
  } finally {
    setProcessing(false);
    // Privacy: file and blob go out of scope here, no references retained
  }
}

// Capture full tab screenshot
async function captureCurrentTabAsFile() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });

  // Scale if needed for performance
  const { dataUrl: processedUrl, scaled } = await scaleImageIfNeeded(dataUrl);
  if (scaled) {
    updateStatus("Scaling large image...");
  }

  // Convert to blob without fetch (no network involved)
  const blob = dataUrlToBlob(processedUrl);
  const file = new File([blob], "screenshot.png", { type: blob.type });
  return { file, dataUrl: processedUrl };
}

// Crop image to region using canvas
async function cropImageToRegion(dataUrl, rect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "region.png", { type: "image/png" });
          resolve(file);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = dataUrl;
  });
}

// Full page OCR handler
async function handleScreenshotClick() {
  if (isProcessing) return;
  try {
    outputEl.value = "";
    updateStatus("Capturing screenshot...");
    const { file } = await captureCurrentTabAsFile();
    await runOcrOnFile(file);
  } catch (err) {
    console.error(err);
    updateStatus("Error: " + (err && err.message ? err.message : String(err)));
    setProcessing(false);
  }
}

// Region selection handler
async function handleRegionClick() {
  if (isProcessing) return;
  try {
    outputEl.value = "";
    updateStatus("Select a region on the page...");

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"],
    });

    // Close the popup - user will interact with the page
    // The background script will handle the rest
    window.close();
  } catch (err) {
    console.error(err);
    updateStatus("Error: " + (err && err.message ? err.message : String(err)));
  }
}

// Listen for messages from background script (for region OCR results)
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === "regionCaptured") {
    handleRegionCapture(message.dataUrl, message.rect);
  }
});

async function handleRegionCapture(dataUrl, rect) {
  try {
    updateStatus("Cropping region...");
    const file = await cropImageToRegion(dataUrl, rect);
    await runOcrOnFile(file);
  } catch (err) {
    console.error(err);
    updateStatus("Error: " + (err && err.message ? err.message : String(err)));
    setProcessing(false);
  }
}

// Event listeners
screenshotBtn.addEventListener("click", () => {
  handleScreenshotClick();
});

regionBtn.addEventListener("click", () => {
  handleRegionClick();
});

copyBtn.addEventListener("click", async () => {
  const text = outputEl.value || "";
  if (!text.trim()) {
    updateStatus("No text to copy");
    return;
  }
  const copied = await copyToClipboard(text);
  if (copied) {
    updateStatus("Copied to clipboard");
  } else {
    updateStatus("Could not copy to clipboard");
  }
});

if (cancelBtn) {
  cancelBtn.addEventListener("click", cancelOcr);
}

// Check if opened in region mode (after user selected a region)
async function checkRegionMode() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("regionMode") === "true") {
    try {
      const result = await chrome.storage.local.get("pendingRegionOcr");
      if (result.pendingRegionOcr) {
        const { dataUrl, rect, timestamp } = result.pendingRegionOcr;
        // Only process if data is less than 1 minute old
        if (Date.now() - timestamp < 60000) {
          await chrome.storage.local.remove("pendingRegionOcr");
          await handleRegionCapture(dataUrl, rect);
        }
      }
    } catch (err) {
      console.error("Error loading region data:", err);
      updateStatus("Error: " + (err.message || String(err)));
    }
  }
}

// Initialize
checkRegionMode();
