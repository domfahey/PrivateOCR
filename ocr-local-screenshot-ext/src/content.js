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

  /** @type {HTMLDivElement|null} Dark overlay covering the page */
  let overlay = null;
  /** @type {HTMLDivElement|null} Dashed rectangle showing user's selection */
  let selectionBox = null;
  /** @type {HTMLDivElement|null} Instruction banner at top of screen */
  let instructions = null;
  /** @type {number} X coordinate where drag started */
  let startX = 0;
  /** @type {number} Y coordinate where drag started */
  let startY = 0;
  /** @type {boolean} Whether the user is currently dragging */
  let isSelecting = false;

  /**
   * Create and inject the overlay elements into the page.
   * Sets up mouse and keyboard event listeners for selection.
   */
  function createOverlay() {
    // Create overlay elements with high z-index to ensure they sit on top of all page content
    overlay = document.createElement("div");
    overlay.style.cssText = `
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

    instructions = document.createElement("div");
    instructions.style.cssText = `
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
    instructions.textContent = "Click and drag to select a region. Press Escape to cancel.";

    document.body.appendChild(overlay);
    document.body.appendChild(selectionBox);
    document.body.appendChild(instructions);

    overlay.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);
  }

  /**
   * Handle mousedown to start selection.
   * Records the starting position and shows the selection box.
   * @param {MouseEvent} e - The mousedown event
   */
  function handleMouseDown(e) {
    e.preventDefault();
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = startX + "px";
    selectionBox.style.top = startY + "px";
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
    e.preventDefault();

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = left + "px";
    selectionBox.style.top = top + "px";
    selectionBox.style.width = width + "px";
    selectionBox.style.height = height + "px";
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

    const currentX = e.clientX;
    const currentY = e.clientY;

    // Normalize coordinates (handle dragging backwards/upwards)
    const rect = {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY),
    };

    // Require minimum selection size
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

    // Clamp to viewport bounds to avoid negative values or overflow
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    rect.x = Math.max(0, rect.x);
    rect.y = Math.max(0, rect.y);
    rect.width = Math.min(rect.width, viewportWidth - rect.x);
    rect.height = Math.min(rect.height, viewportHeight - rect.y);

    // Account for device pixel ratio for high-DPI screens (Retina displays)
    // Screenshots are captured at native resolution, so coordinates need to match
    const dpr = window.devicePixelRatio || 1;
    const scaledRect = {
      x: Math.round(rect.x * dpr),
      y: Math.round(rect.y * dpr),
      width: Math.round(rect.width * dpr),
      height: Math.round(rect.height * dpr),
    };

    cleanup();

    // Send selection to background script to handle capture and popup opening
    // Content scripts cannot use tabs.captureVisibleTab directly
    chrome.runtime
      .sendMessage({
        type: "regionSelected",
        rect: scaledRect,
      })
      .catch((err) => {
        console.error("Failed to send region selection:", err);
      });
  }

  /**
   * Handle keyboard events.
   * Escape key cancels the selection.
   * @param {KeyboardEvent} e - The keydown event
   */
  function handleKeyDown(e) {
    if (e.key === "Escape") {
      cleanup();
    }
  }

  /**
   * Remove all overlay elements and event listeners.
   * Called after selection completes or is cancelled.
   */
  function cleanup() {
    window.__ocrRegionSelectorActive = false;
    if (overlay) overlay.remove();
    if (selectionBox) selectionBox.remove();
    if (instructions) instructions.remove();
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("keydown", handleKeyDown);
  }

  createOverlay();
})();
