// Privacy: Screenshots and OCR text exist in memory only, never persisted
// Privacy: No logging of OCR text content or screenshot data

import { MAX_PIXELS, MAX_DIMENSION } from "../src/utils.js";

/**
 * Initialize the popup logic.
 * Decoupled from the DOM to allow unit testing.
 * @param {Object} elements - References to DOM elements
 */
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

  /**
   * Update UI state based on processing status.
   * @param {boolean} processing - Whether OCR is currently running
   */
  function setProcessing(processing) {
    isProcessing = processing;
    if (screenshotBtn) screenshotBtn.disabled = processing;
    if (regionBtn) regionBtn.disabled = processing;
    // Show cancel button only when processing
    if (cancelBtn) cancelBtn.style.display = processing ? "flex" : "none";
  }

  /**
   * Update the status text and progress bar.
   * @param {string} msg - Status message to display
   * @param {number|null} progress - Progress between 0 and 1, or null
   */
  function updateStatus(msg, progress = null) {
    if (statusEl) statusEl.textContent = msg;

    if (progressTrack && progressIndicator) {
      if (progress !== null) {
        // Determinate progress
        progressTrack.classList.add("active");
        progressIndicator.classList.remove("indeterminate");
        progressIndicator.style.width = `${progress * 100}%`;
      } else if (msg.startsWith("Done") || msg.includes("Error") || msg === "Cancelled") {
        // Finished state: Hide progress bar after a short delay
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

  /**
   * Initialize or retrieve the Tesseract worker.
   * Handles lazy loading and configuration.
   * @returns {Promise<Tesseract.Worker>}
   */
  function getWorker() {
    if (workerPromise) return workerPromise;

    isCancelled = false;

    // Tesseract.js v5 API: createWorker returns a Promise<Worker>
    // It handles load, loadLanguage, and initialize internally
    workerPromise = (async () => {
      updateStatus("Loading OCR engine...");
      const worker = await createWorker("eng", 1, {
        workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
        corePath: chrome.runtime.getURL("vendor/tesseract/tesseract-core-simd.wasm.js"),
        langPath: chrome.runtime.getURL("vendor/tessdata"),
        // Disable Blob URL worker - required for Chrome extension Manifest V3 compliance
        // MV3 does not allow arbitrary blob script execution
        workerBlobURL: false,
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

  /**
   * Cancel the current OCR operation.
   * Terminates the worker to stop processing immediately.
   */
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

  /**
   * Convert data URL to Blob.
   * Manually decodes base64 to avoid using `fetch`, which clarifies that no network request is made.
   */
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

  /**
   * Scale down the image if it exceeds size limits to improve OCR performance and avoid crashes.
   */
  function scaleImageIfNeeded(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const pixels = width * height;

        // Check if scaling is needed based on pixel count or dimensions
        if (pixels <= MAX_PIXELS && width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
          resolve({ dataUrl, scaled: false });
          return;
        }

        // Calculate scale factor to fit within limits
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

  /**
   * Execute OCR on a file.
   * Manages the UI state and worker lifecycle during recognition.
   */
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

  /**
   * Capture the visible area of the current active tab.
   */
  async function captureCurrentTabAsFile() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error("No active tab found");
    }
    // Chrome API to capture the visible tab as a PNG data URL
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

  /**
   * Crop a data URL to a specific region using a canvas.
   */
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
        // Draw only the selected region from the source image onto the canvas
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

  /**
   * Initiate region selection mode.
   * Injects the content script and closes the popup to allow user interaction.
   */
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
      // Prevent injection on restricted pages where content scripts can't run
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

      // Inject the selection overlay script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"],
      });

      // Close the popup so the user can interact with the page
      // The background script will handle the 'regionSelected' message and re-open the popup
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

  /**
   * Check if the popup was opened in "region mode".
   * This happens when the background script re-opens the popup after a region is selected.
   */
  async function checkRegionMode() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("regionMode") === "true") {
      try {
        // Retrieve the captured data stored by the background script
        const result = await chrome.storage.local.get("pendingRegionOcr");
        if (result.pendingRegionOcr) {
          const { dataUrl, rect, timestamp } = result.pendingRegionOcr;
          // Clean up storage immediately
          await chrome.storage.local.remove("pendingRegionOcr");
          // Only process if data is fresh (< 1 minute) to avoid processing stale data
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