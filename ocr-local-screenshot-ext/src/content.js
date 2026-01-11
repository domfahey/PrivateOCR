/**
 * Region Selection Overlay for PrivateOCR
 *
 * This content script is injected into the active tab when the user clicks
 * "Select Region". It creates a full-page overlay that allows the user to
 * draw a rectangle around the area they want to OCR.
 *
 * Flow:
 * 1. popup-logic.js injects this script via chrome.scripting.executeScript
 * 2. User draws a selection rectangle on the overlay
 * 3. Coordinates are sent to background.js via chrome.runtime.sendMessage
 * 4. background.js captures the tab and opens the popup in region mode
 *
 * @module content
 */
(function () {
  // Prevent multiple injections (e.g., if user clicks "Select Region" twice)
  if (window.__ocrRegionSelectorActive) return;
  window.__ocrRegionSelectorActive = true;

  let selectionOverlay = null;
  let selectionBox = null;
  let instructionsPanel = null;
  let selectionStartX = 0;
  let selectionStartY = 0;
  let isSelecting = false;

  /**
   * Create and inject the overlay elements into the page.
   * Sets up mouse and keyboard event listeners for selection.
   */
  function createOverlay() {
    // Create overlay elements with high z-index to ensure they sit on top of all page content
    selectionOverlay = document.createElement("div");
    selectionOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      cursor: crosshair;
      z-index: 2147483647;
    `;

    selectionBox = document.createElement("div");
    selectionBox.style.cssText = `
      position: fixed;
      border: 2px dashed #fff;
      background: rgba(255, 255, 255, 0.1);
      display: none;
      z-index: 2147483647;
    `;

    instructionsPanel = document.createElement("div");
    instructionsPanel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
    `;
    instructionsPanel.textContent = "Click and drag to select a region. Press Escape to cancel.";

    document.body.appendChild(selectionOverlay);
    document.body.appendChild(selectionBox);
    document.body.appendChild(instructionsPanel);

    selectionOverlay.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);
  }

  function handleMouseDown(event) {
    event.preventDefault();
    isSelecting = true;
    selectionStartX = event.clientX;
    selectionStartY = event.clientY;
    selectionBox.style.left = selectionStartX + "px";
    selectionBox.style.top = selectionStartY + "px";
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";
    selectionBox.style.display = "block";
  }

  /**
   * Handle mousemove to update the selection box size.
   * Allows dragging in any direction (handles negative widths/heights).
   * @param {MouseEvent} e - The mousemove event
   */
  function handleMouseMove(e) {
    if (!isSelecting) return;
    event.preventDefault();

    const currentMouseX = event.clientX;
    const currentMouseY = event.clientY;

    const selectionLeft = Math.min(selectionStartX, currentMouseX);
    const selectionTop = Math.min(selectionStartY, currentMouseY);
    const selectionWidth = Math.abs(currentMouseX - selectionStartX);
    const selectionHeight = Math.abs(currentMouseY - selectionStartY);

    selectionBox.style.left = selectionLeft + "px";
    selectionBox.style.top = selectionTop + "px";
    selectionBox.style.width = selectionWidth + "px";
    selectionBox.style.height = selectionHeight + "px";
  }

  /**
   * Handle mouseup to complete the selection.
   * Calculates final coordinates, scales for device pixel ratio,
   * and sends the selection to the background script.
   * @param {MouseEvent} e - The mouseup event
   */
  function handleMouseUp(e) {
    if (!isSelecting) return;
    isSelecting = false;

    const selectionEndX = event.clientX;
    const selectionEndY = event.clientY;

    // Normalize coordinates (handle dragging backwards/upwards)
    const selectedRegion = {
      x: Math.min(selectionStartX, selectionEndX),
      y: Math.min(selectionStartY, selectionEndY),
      width: Math.abs(selectionEndX - selectionStartX),
      height: Math.abs(selectionEndY - selectionStartY),
    };

    // Clamp to viewport bounds to avoid negative values or overflow
    // This must happen BEFORE size validation to catch edge cases where
    // a selection looks valid but becomes too small after clamping
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    selectedRegion.x = Math.max(0, selectedRegion.x);
    selectedRegion.y = Math.max(0, selectedRegion.y);
    selectedRegion.width = Math.min(selectedRegion.width, viewportWidth - selectedRegion.x);
    selectedRegion.height = Math.min(selectedRegion.height, viewportHeight - selectedRegion.y);

    // Require minimum selection size AFTER clamping
    if (rect.width < 10 || rect.height < 10) {
      // Notify background script that selection was cancelled due to size
      chrome.runtime
        .sendMessage({
          type: "regionCancelled",
          reason: "tooSmall",
        })
        .catch(() => {
          // Ignore errors if background script is not listening
        });
      cleanup();
      return;
    }

    // Account for device pixel ratio for high-DPI screens (Retina displays)
    // Screenshots are captured at native resolution, so coordinates need to match
    const devicePixelRatio = window.devicePixelRatio || 1;
    const deviceScaledRegion = {
      x: Math.round(selectedRegion.x * devicePixelRatio),
      y: Math.round(selectedRegion.y * devicePixelRatio),
      width: Math.round(selectedRegion.width * devicePixelRatio),
      height: Math.round(selectedRegion.height * devicePixelRatio),
    };

    cleanup();

    // Send selection to background script to handle capture and popup opening
    // Content scripts cannot use tabs.captureVisibleTab directly
    chrome.runtime
      .sendMessage({
        type: "regionSelected",
        rect: deviceScaledRegion,
      })
      .catch((error) => {
        console.error("Failed to send region selection:", error);
      });
  }

  /**
   * Handle keyboard events.
   * Escape key cancels the selection.
   * @param {KeyboardEvent} e - The keydown event
   */
  function handleKeyDown(e) {
    if (e.key === "Escape") {
      // Notify background script that selection was cancelled by Escape
      chrome.runtime
        .sendMessage({
          type: "regionCancelled",
          reason: "escape",
        })
        .catch(() => {
          // Ignore errors if background script is not listening
        });
      cleanup();
    }
  }

  /**
   * Remove all overlay elements and event listeners.
   * Called after selection completes or is cancelled.
   */
  function cleanup() {
    window.__ocrRegionSelectorActive = false;
    if (selectionOverlay) selectionOverlay.remove();
    if (selectionBox) selectionBox.remove();
    if (instructionsPanel) instructionsPanel.remove();
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("keydown", handleKeyDown);
  }

  createOverlay();
})();
