// Privacy: Screenshots and OCR text exist in memory only, never persisted
// Privacy: No logging of OCR text content or screenshot data

import { MAX_PIXELS, MAX_DIMENSION } from "../src/utils.js";

export function init(elements) {
  const { createWorker } = Tesseract;
  const {
    statusEl,
    outputEl,
    screenshotBtn,
    regionBtn,
    copyBtn,
    cancelBtn,
    progressTrack,
    progressIndicator,
  } = elements;

  // State variables
  let workerPromise = null;
  let currentWorker = null;
  let isProcessing = false;
  let isCancelled = false;

  function setProcessing(processing) {
    isProcessing = processing;
    if (screenshotBtn) screenshotBtn.disabled = processing;
    if (regionBtn) regionBtn.disabled = processing;
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

    isCancelled = false;

    workerPromise = (async () => {
      updateStatus("Loading OCR engine...");
      const worker = await createWorker("eng", 1, {
        workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
        corePath: chrome.runtime.getURL("vendor/tesseract/tesseract-core-simd.wasm.js"),
        langPath: chrome.runtime.getURL("vendor/tessdata"),
        workerBlobURL: false, // Disable Blob URL worker - required for Chrome extension MV3
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
      if (isCancelled) {
        await worker.terminate();
        throw new Error("Cancelled");
      }
      currentWorker = worker;
      updateStatus("Ready");
      return worker;
    })();

    return workerPromise;
  }

  async function cancelOcr() {
    isCancelled = true;

    if (currentWorker) {
      try {
        await currentWorker.terminate();
      } catch (err) {
        // Ignore termination errors
      }
    }
    workerPromise = null;
    currentWorker = null;
    setProcessing(false);
    updateStatus("Cancelled");
  }

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

  function dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") {
      throw new Error("Invalid data URL: must be a non-empty string");
    }
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) {
      throw new Error("Invalid data URL: missing comma separator");
    }
    const header = dataUrl.slice(0, commaIndex);
    const base64 = dataUrl.slice(commaIndex + 1);
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    try {
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } catch (err) {
      throw new Error("Invalid data URL: failed to decode base64 content");
    }
  }

  function scaleImageIfNeeded(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const pixels = width * height;

        if (pixels <= MAX_PIXELS && width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
          resolve({ dataUrl, scaled: false });
          return;
        }

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

        const canvas = document.createElement("canvas");
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ dataUrl, scaled: false });
          return;
        }
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        resolve({ dataUrl: canvas.toDataURL("image/png"), scaled: true });
      };
      img.onerror = () => resolve({ dataUrl, scaled: false });
      img.src = dataUrl;
    });
  }

  async function runOcrOnFile(file) {
    try {
      setProcessing(true);
      const worker = await getWorker();
      updateStatus("Recognizing...");
      const { data } = await worker.recognize(file);
      const text = data.text || "";
      outputEl.value = text;

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
    }
  }

  async function captureCurrentTabAsFile() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error("No active tab found");
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    const { dataUrl: processedUrl, scaled } = await scaleImageIfNeeded(dataUrl);
    if (scaled) {
      updateStatus("Scaling large image...");
    }

    const blob = dataUrlToBlob(processedUrl);
    const file = new File([blob], "screenshot.png", { type: blob.type });
    return { file, dataUrl: processedUrl };
  }

  async function cropImageToRegion(dataUrl, rect) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(
          img,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          rect.width,
          rect.height,
        );
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

  async function handleScreenshotClick() {
    if (isProcessing) return;
    try {
      outputEl.value = "";
      updateStatus("Capturing screenshot...");
      const { file } = await captureCurrentTabAsFile();
      await runOcrOnFile(file);
    } catch (err) {
      if (isCancelled || (err && err.message === "Cancelled")) {
        updateStatus("Cancelled");
      } else {
        console.error(err);
        updateStatus("Error: " + (err && err.message ? err.message : String(err)));
      }
      setProcessing(false);
    }
  }

  async function handleRegionClick() {
    if (isProcessing) return;
    try {
      outputEl.value = "";
      updateStatus("Select a region on the page...");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url) {
        updateStatus("Error: Cannot access this tab");
        return;
      }
      if (
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("brave://")
      ) {
        updateStatus("Error: Cannot select region on browser pages");
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"],
      });

      window.close();
    } catch (err) {
      console.error(err);
      const msg = err && err.message ? err.message : String(err);
      if (msg.includes("Cannot access") || msg.includes("chrome://")) {
        updateStatus("Error: Cannot select region on this page");
      } else {
        updateStatus("Error: " + msg);
      }
    }
  }

  async function handleRegionCapture(dataUrl, rect) {
    try {
      updateStatus("Cropping region...");
      const file = await cropImageToRegion(dataUrl, rect);
      await runOcrOnFile(file);
    } catch (err) {
      if (isCancelled || (err && err.message === "Cancelled")) {
        updateStatus("Cancelled");
      } else {
        console.error(err);
        updateStatus("Error: " + (err && err.message ? err.message : String(err)));
      }
      setProcessing(false);
    }
  }

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

  async function checkRegionMode() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("regionMode") === "true") {
      try {
        const result = await chrome.storage.local.get("pendingRegionOcr");
        if (result.pendingRegionOcr) {
          const { dataUrl, rect, timestamp } = result.pendingRegionOcr;
          await chrome.storage.local.remove("pendingRegionOcr");
          if (Date.now() - timestamp < 60000) {
            await handleRegionCapture(dataUrl, rect);
          } else {
            updateStatus("Region data expired, please try again");
          }
        }
      } catch (err) {
        console.error("Error loading region data:", err);
        updateStatus("Error: " + (err.message || String(err)));
      }
    }
  }

  checkRegionMode();
}