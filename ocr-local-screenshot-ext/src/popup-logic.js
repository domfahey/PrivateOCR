// Privacy: Screenshots and OCR text exist in memory only, never persisted
// Privacy: No logging of OCR text content or screenshot data

import { MAX_PIXELS, MAX_DIMENSION } from "../src/utils.js";

/**
 * Initialize the popup logic.
 * Decoupled from the DOM to allow unit testing.
 * @param {Object} elements - References to DOM elements
 */
export function init(elements) {
  const { createWorker, OEM } = Tesseract;
  const {
    statusEl,
    outputEl,
    screenshotBtn,
    regionBtn,
    copyBtn,
    cancelBtn,
    progressTrack,
    progressIndicator,
    previewImage,
    contentArea,
    showPreviewCheckbox,
  } = elements;

  // State variables
  let tesseractWorkerPromise = null;
  let currentTesseractWorker = null;
  let isProcessing = false;
  let isCancelled = false;
  let currentImageDataUrl = null;

  function togglePreview() {
    const showPreview = showPreviewCheckbox.checked;
    if (showPreview && currentImageDataUrl) {
      contentArea.classList.add("split-view");
      previewImage.src = currentImageDataUrl;
      // Parent container visibility is handled by CSS .split-view .preview-container
    } else {
      contentArea.classList.remove("split-view");
    }
  }

  function updatePreview(dataUrl) {
    currentImageDataUrl = dataUrl;
    if (showPreviewCheckbox.checked) {
      togglePreview();
    }
  }

  if (showPreviewCheckbox) {
    showPreviewCheckbox.addEventListener("change", togglePreview);
  }

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
   * @param {string} statusMessage - Status message to display
   * @param {number|null} progress - Progress between 0 and 1, or null
   */
  function updateStatus(statusMessage, progress = null) {
    if (statusEl) statusEl.textContent = statusMessage;

    if (progressTrack && progressIndicator) {
      if (progress !== null) {
        // Determinate progress
        progressTrack.classList.add("active");
        progressIndicator.classList.remove("indeterminate");
        progressIndicator.style.width = `${progress * 100}%`;
      } else if (statusMessage.startsWith("Done") || statusMessage.includes("Error") || statusMessage === "Cancelled") {
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
    console.log(statusMessage);
  }

  /**
   * Initialize or retrieve the Tesseract worker.
   * Handles lazy loading and configuration.
   * @returns {Promise<Tesseract.Worker>}
   */
  function getWorker() {
    if (tesseractWorkerPromise) return tesseractWorkerPromise;

    isCancelled = false;

    // Tesseract.js v5 API: createWorker returns a Promise<Worker>
    // It handles load, loadLanguage, and initialize internally
    tesseractWorkerPromise = (async () => {
      updateStatus("Loading OCR engine...");
      const worker = await createWorker("eng", OEM.LSTM_ONLY, {
        workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
        corePath: chrome.runtime.getURL("vendor/tesseract/"),
        langPath: chrome.runtime.getURL("vendor/tessdata"),
        // Disable Blob URL worker - required for Chrome extension Manifest V3 compliance
        // MV3 does not allow arbitrary blob script execution
        workerBlobURL: false,
        logger: (logMessage) => {
          if (logMessage.status) {
            if (typeof logMessage.progress === "number") {
              updateStatus(`${logMessage.status} ${(logMessage.progress * 100).toFixed(0)}%`, logMessage.progress);
            } else {
              updateStatus(logMessage.status);
            }
          }
        },
      });
      if (isCancelled) {
        await worker.terminate();
        throw new Error("Cancelled");
      }
      currentTesseractWorker = worker;
      updateStatus("Ready");
      return worker;
    })();

    return tesseractWorkerPromise;
  }

  /**
   * Cancel the current OCR operation.
   * Terminates the worker to stop processing immediately.
   */
  async function cancelOcr() {
    isCancelled = true;

    if (currentTesseractWorker) {
      try {
        await currentTesseractWorker.terminate();
      } catch (error) {
        // Ignore termination errors
      }
    }
    tesseractWorkerPromise = null;
    currentTesseractWorker = null;
    setProcessing(false);
    updateStatus("Cancelled");
  }

  async function copyToClipboard(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Clipboard error:", error);
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
    const dataUrlHeader = dataUrl.slice(0, commaIndex);
    const base64Content = dataUrl.slice(commaIndex + 1);
    const mimeMatch = dataUrlHeader.match(/data:(.*?);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    try {
      const binaryString = atob(base64Content);
      const byteLength = binaryString.length;
      const byteArray = new Uint8Array(byteLength);
      for (let i = 0; i < byteLength; i++) byteArray[i] = binaryString.charCodeAt(i);
      return new Blob([byteArray], { type: mimeType });
    } catch (error) {
      throw new Error("Invalid data URL: failed to decode base64 content");
    }
  }

  /**
   * Scale down the image if it exceeds size limits to improve OCR performance and avoid crashes.
   */
  function scaleImageIfNeeded(dataUrl) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const { width, height } = image;
        const totalPixels = width * height;

        // Check if scaling is needed based on pixel count or dimensions
        if (totalPixels <= MAX_PIXELS && width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
          resolve({ dataUrl, scaled: false });
          return;
        }

        // Calculate scale factor to fit within limits
        let scaleFactor = 1;
        if (totalPixels > MAX_PIXELS) {
          scaleFactor = Math.sqrt(MAX_PIXELS / totalPixels);
        }
        if (width * scaleFactor > MAX_DIMENSION) {
          scaleFactor = MAX_DIMENSION / width;
        }
        if (height * scaleFactor > MAX_DIMENSION) {
          scaleFactor = MAX_DIMENSION / height;
        }

        const scaledWidth = Math.floor(width * scaleFactor);
        const scaledHeight = Math.floor(height * scaleFactor);

        const canvas = document.createElement("canvas");
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) {
          resolve({ dataUrl, scaled: false });
          return;
        }
        canvasContext.drawImage(image, 0, 0, scaledWidth, scaledHeight);

        resolve({ dataUrl: canvas.toDataURL("image/png"), scaled: true });
      };
      image.onerror = () => resolve({ dataUrl, scaled: false });
      image.src = dataUrl;
    });
  }

  /**
   * Execute OCR on a file.
   * Manages the UI state and worker lifecycle during recognition.
   */
  async function runOcrOnFile(screenshotFile) {
    try {
      setProcessing(true);
      const worker = await getWorker();
      updateStatus("Recognizing...");
      const { data } = await worker.recognize(screenshotFile);
      const recognizedText = data.text || "";
      outputEl.value = recognizedText;

      if (recognizedText.trim()) {
        const copiedSuccessfully = await copyToClipboard(recognizedText);
        const characterCount = recognizedText.length;
        const wordCount = recognizedText.trim().split(/\s+/).length;
        if (copiedSuccessfully) {
          updateStatus(`Done - ${wordCount} words, ${characterCount} chars (copied to clipboard)`);
        } else {
          updateStatus(`Done - ${wordCount} words, ${characterCount} chars`);
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
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      throw new Error("No active tab found");
    }
    // Chrome API to capture the visible tab as a PNG data URL
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: "png",
    });

    const { dataUrl: processedDataUrl, scaled } = await scaleImageIfNeeded(screenshotDataUrl);
    if (scaled) {
      updateStatus("Scaling large image...");
    }

    const screenshotBlob = dataUrlToBlob(processedDataUrl);
    const screenshotFile = new File([screenshotBlob], "screenshot.png", { type: screenshotBlob.type });
    return { file: screenshotFile, dataUrl: processedDataUrl };
  }

  /**
   * Crop a data URL to a specific region using a canvas.
   */
  async function cropImageToRegion(dataUrl, selectionRect) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = selectionRect.width;
        canvas.height = selectionRect.height;
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        // Draw only the selected region from the source image onto the canvas
        canvasContext.drawImage(image, selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height, 0, 0, selectionRect.width, selectionRect.height);
        const croppedDataUrl = canvas.toDataURL("image/png");
        canvas.toBlob((imageBlob) => {
          if (imageBlob) {
            const croppedFile = new File([imageBlob], "region.png", { type: "image/png" });
            resolve({ file: croppedFile, dataUrl: croppedDataUrl });
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        }, "image/png");
      };
      image.onerror = () => reject(new Error("Failed to load image for cropping"));
      image.src = dataUrl;
    });
  }

  async function handleScreenshotClick() {
    if (isProcessing) return;
    try {
      outputEl.value = "";
      updateStatus("Capturing screenshot...");
      const { file: screenshotFile, dataUrl } = await captureCurrentTabAsFile();
      updatePreview(dataUrl);
      await runOcrOnFile(screenshotFile);
    } catch (error) {
      if (isCancelled || (error && error.message === "Cancelled")) {
        updateStatus("Cancelled");
      } else {
        console.error(error);
        updateStatus("Error: " + (error && error.message ? error.message : String(error)));
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

      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!activeTab || !activeTab.url) {
        updateStatus("Error: Cannot access this tab");
        return;
      }
      // Prevent injection on restricted pages where content scripts can't run
      if (
        activeTab.url.startsWith("chrome://") ||
        activeTab.url.startsWith("chrome-extension://") ||
        activeTab.url.startsWith("about:") ||
        activeTab.url.startsWith("edge://") ||
        activeTab.url.startsWith("brave://")
      ) {
        updateStatus("Error: Cannot select region on browser pages");
        return;
      }

      // Inject the selection overlay script
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["src/content.js"],
      });

      // Close the popup so the user can interact with the page
      // The background script will handle the 'regionSelected' message and re-open the popup
      window.close();
    } catch (error) {
      console.error(error);
      const errorMessage = error && error.message ? error.message : String(error);
      if (errorMessage.includes("Cannot access") || errorMessage.includes("chrome://")) {
        updateStatus("Error: Cannot select region on this page");
      } else {
        updateStatus("Error: " + errorMessage);
      }
    }
  }

  async function handleRegionCapture(screenshotDataUrl, selectionRect) {
    try {
      updateStatus("Cropping region...");
      const { file: croppedFile, dataUrl: croppedDataUrl } = await cropImageToRegion(screenshotDataUrl, selectionRect);
      updatePreview(croppedDataUrl);
      await runOcrOnFile(croppedFile);
    } catch (error) {
      if (isCancelled || (error && error.message === "Cancelled")) {
        updateStatus("Cancelled");
      } else {
        console.error(error);
        updateStatus("Error: " + (error && error.message ? error.message : String(error)));
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
    const outputText = outputEl.value || "";
    if (!outputText.trim()) {
      updateStatus("No text to copy");
      return;
    }
    const copiedSuccessfully = await copyToClipboard(outputText);
    if (copiedSuccessfully) {
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
        const storageResult = await chrome.storage.local.get("pendingRegionOcr");
        if (storageResult.pendingRegionOcr) {
          const { dataUrl: screenshotDataUrl, rect: selectionRect, timestamp: captureTimestamp } = storageResult.pendingRegionOcr;
          // Clean up storage immediately
          await chrome.storage.local.remove("pendingRegionOcr");
          // Only process if data is fresh (< 1 minute) to avoid processing stale data
          if (Date.now() - captureTimestamp < 60000) {
            await handleRegionCapture(screenshotDataUrl, selectionRect);
          } else {
            updateStatus("Region data expired, please try again");
          }
        }
      } catch (error) {
        console.error("Error loading region data:", error);
        updateStatus("Error: " + (error.message || String(error)));
      }
    }
  }

  checkRegionMode();
}
