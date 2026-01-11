/**
 * Popup Logic for PrivateOCR
 *
 * Main business logic for the extension popup. Handles:
 * - Full-page OCR: Capture visible tab and run Tesseract.js
 * - Region OCR: Process cropped regions from content script selection
 * - UI state management: Progress, status, zoom controls
 * - Tesseract worker lifecycle: Lazy initialization, cancellation
 *
 * Privacy guarantees:
 * - Screenshots and OCR text exist in memory only, never persisted
 * - No logging of OCR text content or screenshot data
 * - No network requests (all resources loaded from extension)
 *
 * @module popup-logic
 */

import { MAX_PIXELS, MAX_DIMENSION, dataUrlToBlob, scaleImageIfNeeded } from "../src/utils.js";

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
    emptyImageState,
    contentArea,
    settingsBtn,
    toggleImageBtn,
    imgZoomInBtn,
    imgZoomOutBtn,
    imgZoomFitBtn,
    textZoomInBtn,
    textZoomOutBtn,
  } = elements;

  // State variables
  let workerPromise = null;
  let currentWorker = null;
  let isProcessing = false;
  let isCancelled = false;
  let operationId = 0; // Unique ID for each OCR operation to prevent race conditions
  let currentImageDataUrl = null;
  let sourceWindowId = null; // Original window ID when in region mode
  let isRegionModePopup = false; // True if opened as region mode popup

  // UI State
  let isPreviewVisible = true;
  let imgScale = 1.0;
  let isImgFit = true;
  let textSize = 15; // Must match CSS .md-text-field font-size
  let copyButtonTimeoutId = null; // Track timeout to prevent race condition
  let copyButtonOriginalHtml = null; // Store original HTML to restore after timeout

  function updatePreviewVisibility() {
    if (isPreviewVisible) {
      // Always allow toggle, even if empty (shows placeholder)
      contentArea.classList.add("split-view");
      if (toggleImageBtn) toggleImageBtn.classList.add("active");
    } else {
      contentArea.classList.remove("split-view");
      if (toggleImageBtn) toggleImageBtn.classList.remove("active");
    }
  }

  function updatePreview(dataUrl) {
    currentImageDataUrl = dataUrl;

    if (dataUrl) {
      previewImage.src = dataUrl;
      previewImage.style.display = "block";
      if (emptyImageState) emptyImageState.style.display = "none";

      // Reset zoom on new image
      isImgFit = true;
      imgScale = 1.0;
      applyImageZoom();
    } else {
      previewImage.style.display = "none";
      previewImage.src = "";
      if (emptyImageState) emptyImageState.style.display = "flex";
    }

    // Force visibility update to show split view if active
    updatePreviewVisibility();
  }

  function applyImageZoom() {
    if (!currentImageDataUrl) return;

    if (isImgFit) {
      previewImage.style.maxWidth = "100%";
      previewImage.style.width = "auto";
      previewImage.style.height = "auto";
    } else {
      previewImage.style.maxWidth = "none";
      previewImage.style.height = "auto";
      const baseWidth = previewImage.naturalWidth || previewImage.width || 800;
      previewImage.style.width = `${baseWidth * imgScale}px`;
    }
  }

  function applyTextZoom() {
    outputEl.style.fontSize = `${textSize}px`;
  }

  // Event Listeners
  if (toggleImageBtn) {
    toggleImageBtn.addEventListener("click", () => {
      isPreviewVisible = !isPreviewVisible;
      updatePreviewVisibility();
    });
  }

  if (imgZoomInBtn) {
    imgZoomInBtn.addEventListener("click", () => {
      if (!currentImageDataUrl) return;
      if (isImgFit) {
        isImgFit = false;
        imgScale = 1.0;
      }
      imgScale *= 1.2;
      applyImageZoom();
    });
  }

  if (imgZoomOutBtn) {
    imgZoomOutBtn.addEventListener("click", () => {
      if (!currentImageDataUrl) return;
      if (isImgFit) {
        isImgFit = false;
        imgScale = 1.0;
      }
      imgScale /= 1.2;
      applyImageZoom();
    });
  }

  if (imgZoomFitBtn) {
    imgZoomFitBtn.addEventListener("click", () => {
      if (!currentImageDataUrl) return;
      isImgFit = true;
      imgScale = 1.0;
      applyImageZoom();
    });
  }

  if (textZoomInBtn) {
    textZoomInBtn.addEventListener("click", () => {
      textSize = Math.min(textSize + 2, 32); // Max 32px
      applyTextZoom();
    });
  }

  if (textZoomOutBtn) {
    textZoomOutBtn.addEventListener("click", () => {
      textSize = Math.max(textSize - 2, 10); // Min 10px
      applyTextZoom();
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/settings.html") });
    });
  }

  // Handle image load to ensure dimensions are correct for zoom
  if (previewImage) {
    previewImage.addEventListener("load", () => {
      if (!isImgFit) applyImageZoom();
    });
  }

  /**
   * Update UI state based on processing status.
   * @param {boolean} processing - Whether OCR is currently running
   */
  function setProcessing(processing) {
    isProcessing = processing;
    if (screenshotBtn) screenshotBtn.disabled = processing;
    // Keep region button disabled in region mode popup (can't inject into extension pages)
    if (regionBtn) regionBtn.disabled = processing || isRegionModePopup;
    // Show cancel button only when processing
    if (cancelBtn) cancelBtn.style.display = processing ? "flex" : "none";
  }

  /**
   * Update the status text and progress bar.
   * @param {string} msg - Status message to display
   * @param {number|null} progress - Progress between 0 and 1, or null
   */
  // Statuses that indicate active processing (show indeterminate progress bar)
  const PROCESSING_STATUSES = [
    "Capturing screenshot...",
    "Loading OCR engine...",
    "Recognizing...",
    "Cropping region...",
    "Scaling large image...",
    "Select a region on the page...",
  ];

  function updateStatus(msg, progress = null) {
    if (statusEl) statusEl.textContent = msg;

    if (progressTrack && progressIndicator) {
      if (progress !== null) {
        // Determinate progress
        progressTrack.classList.add("active");
        progressIndicator.classList.remove("indeterminate");
        progressIndicator.style.width = `${progress * 100}%`;
      } else if (PROCESSING_STATUSES.some((s) => msg.startsWith(s))) {
        // Indeterminate state for loading/initializing
        progressTrack.classList.add("active");
        progressIndicator.classList.add("indeterminate");
        progressIndicator.style.width = "50%"; // Trigger css animation
      } else {
        // Idle/finished state: Hide progress bar
        // This handles: Done, Error, Cancelled, Ready, Copied, No text to copy, etc.
        progressTrack.classList.remove("active");
        progressIndicator.classList.remove("indeterminate");
        progressIndicator.style.width = "0%";
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

    // Increment operation ID for this new worker creation
    const myOperationId = ++operationId;

    // Tesseract.js v7 API: createWorker returns a Promise<Worker>
    // It handles load, loadLanguage, and initialize internally
    workerPromise = (async () => {
      updateStatus("Loading OCR engine...");
      const worker = await createWorker("eng", OEM.LSTM_ONLY, {
        workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
        corePath: chrome.runtime.getURL("vendor/tesseract/"),
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
      // Check if this operation was cancelled OR if a newer operation started
      if (isCancelled || myOperationId !== operationId) {
        await worker.terminate();
        throw new Error("Cancelled");
      }
      currentWorker = worker;
      updateStatus("Ready");
      return worker;
    })().catch((err) => {
      // Reset cached promise on failure so user can retry
      workerPromise = null;
      currentWorker = null;
      throw err;
    });

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
   * Get the window ID of the current active tab.
   * @returns {Promise<number>} The window ID
   */
  async function getActiveWindowId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error("No active tab found");
    }
    return tab.windowId;
  }

  /**
   * Capture the visible area of the current active tab.
   * In region mode, uses the stored source window ID to capture from the original page.
   */
  async function captureCurrentTabAsFile() {
    // In region mode, use the stored source window ID instead of querying active tab
    // This prevents capturing the popup window itself
    const windowId = sourceWindowId || (await getActiveWindowId());
    // Chrome API to capture the visible tab as a PNG data URL
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: "png",
    });

    // Check if scaling is needed and show status BEFORE the expensive operation
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Failed to load captured image"));
      img.src = dataUrl;
    });
    const needsScaling =
      img.width * img.height > MAX_PIXELS ||
      img.width > MAX_DIMENSION ||
      img.height > MAX_DIMENSION;
    if (needsScaling) {
      updateStatus("Scaling large image...");
    }

    const { dataUrl: processedUrl } = await scaleImageIfNeeded(dataUrl);

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
        ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
        const croppedDataUrl = canvas.toDataURL("image/png");
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "region.png", { type: "image/png" });
            resolve({ file, dataUrl: croppedDataUrl });
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
    // Reset cancellation state and increment operation ID for new user action
    isCancelled = false;
    operationId++;
    // Set processing immediately to prevent double-clicks and show cancel button
    setProcessing(true);
    try {
      outputEl.value = "";
      updateStatus("Capturing screenshot...");
      const { file, dataUrl } = await captureCurrentTabAsFile();
      updatePreview(dataUrl);
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
    // Reset cancellation state and increment operation ID for new user action
    isCancelled = false;
    operationId++;
    setProcessing(true);
    try {
      updateStatus("Cropping region...");
      const { dataUrl: croppedDataUrl } = await cropImageToRegion(dataUrl, rect);

      // Scale down if the cropped region is too large
      const { dataUrl: processedUrl, scaled } = await scaleImageIfNeeded(croppedDataUrl);
      if (scaled) {
        updateStatus("Scaling large image...");
      }

      updatePreview(processedUrl);
      const blob = dataUrlToBlob(processedUrl);
      const file = new File([blob], "region.png", { type: blob.type });
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

      // Cancel any pending timeout to prevent race condition on rapid clicks
      if (copyButtonTimeoutId) {
        clearTimeout(copyButtonTimeoutId);
        copyButtonTimeoutId = null;
      }

      // Store original HTML only once (before first click changes it)
      if (!copyButtonOriginalHtml) {
        copyButtonOriginalHtml = copyBtn.innerHTML;
      }

      // Visual feedback
      // Note: innerHTML is safe here as content is static/hardcoded, not user input
      copyBtn.innerHTML = `
        <span class="icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </span>
        <span>Copied!</span>
      `;

      copyButtonTimeoutId = setTimeout(() => {
        copyBtn.innerHTML = copyButtonOriginalHtml;
        copyButtonTimeoutId = null;
      }, 2000);
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
      // Mark as region mode popup and disable region selection
      // (can't inject content scripts into extension pages)
      isRegionModePopup = true;
      if (regionBtn) regionBtn.disabled = true;

      try {
        // Retrieve the captured data stored by the background script
        const result = await chrome.storage.local.get("pendingRegionOcr");
        if (result.pendingRegionOcr) {
          const {
            dataUrl,
            rect,
            timestamp,
            sourceWindowId: storedWindowId,
          } = result.pendingRegionOcr;
          // Store source window ID for future captures in this popup
          sourceWindowId = storedWindowId;
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
