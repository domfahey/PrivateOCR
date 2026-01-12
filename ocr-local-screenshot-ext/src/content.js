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
  let activePointerId = null; // Track the pointer for capture/release

  /**
   * Create and inject the overlay elements into the page.
   * Sets up pointer and keyboard event listeners for selection.
   * Uses Pointer Events API to handle mouse release outside browser window.
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
      pointer-events: none;
    `;
    instructionsPanel.textContent = "Click and drag to select a region. Press Escape to cancel.";

    document.body.appendChild(selectionOverlay);
    document.body.appendChild(selectionBox);
    document.body.appendChild(instructionsPanel);

    // Use Pointer Events API for reliable handling even when mouse is released outside window
    selectionOverlay.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("keydown", handleKeyDown);
  }

  function handlePointerDown(event) {
    // Only respond to left-click (button 0), ignore right-click (2) and middle-click (1)
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation(); // Prevent page scripts from intercepting selection gestures
    isSelecting = true;
    activePointerId = event.pointerId;

    // Capture pointer to receive events even when pointer moves outside window
    selectionOverlay.setPointerCapture(event.pointerId);

    selectionStartX = event.clientX;
    selectionStartY = event.clientY;
    selectionBox.style.left = selectionStartX + "px";
    selectionBox.style.top = selectionStartY + "px";
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";
    selectionBox.style.display = "block";
  }

  function handlePointerMove(event) {
    if (!isSelecting) return;
    event.preventDefault();
    event.stopPropagation(); // Prevent page scripts from intercepting selection gestures

    const currentPointerX = event.clientX;
    const currentPointerY = event.clientY;

    const selectionLeft = Math.min(selectionStartX, currentPointerX);
    const selectionTop = Math.min(selectionStartY, currentPointerY);
    const selectionWidth = Math.abs(currentPointerX - selectionStartX);
    const selectionHeight = Math.abs(currentPointerY - selectionStartY);

    selectionBox.style.left = selectionLeft + "px";
    selectionBox.style.top = selectionTop + "px";
    selectionBox.style.width = selectionWidth + "px";
    selectionBox.style.height = selectionHeight + "px";
  }

  function handlePointerUp(event) {
    if (!isSelecting) return;
    event.stopPropagation(); // Prevent page scripts from intercepting selection gestures
    isSelecting = false;

    // Release pointer capture
    if (activePointerId !== null && selectionOverlay) {
      selectionOverlay.releasePointerCapture(activePointerId);
      activePointerId = null;
    }

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
    if (selectedRegion.width < 10 || selectedRegion.height < 10) {
      // Notify background script that selection was cancelled due to size
      chrome.runtime
        .sendMessage({
          type: "regionCancelled",
          reason: "tooSmall",
        })
        .catch((err) => {
          // Log cancellation errors but don't alert - user already sees overlay close
          console.warn("Failed to send cancellation message (non-critical):", err.message);
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

    // Wait for the browser to repaint (overlay removed from screen) before triggering capture
    // This prevents the overlay/selection box from appearing in the screenshot
    requestAnimationFrame(() => {
      // Send selection to background script to handle capture and popup opening
      // Content scripts cannot use tabs.captureVisibleTab directly
      chrome.runtime
        .sendMessage({
          type: "regionSelected",
          rect: deviceScaledRegion,
        })
        .catch((error) => {
          console.error("Failed to send region selection:", error);
          // Alert user since they're waiting for popup that won't open
          // This is a last resort when extension context is invalidated
          window.alert(
            "PrivateOCR: Failed to capture region. Please try again or reload the extension."
          );
        });
    });
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      // Prevent page handlers from also responding to Escape (e.g., closing modals)
      event.preventDefault();
      event.stopPropagation();
      // Notify background script that selection was cancelled by Escape
      chrome.runtime
        .sendMessage({
          type: "regionCancelled",
          reason: "escape",
        })
        .catch((err) => {
          // Log cancellation errors but don't alert - user already sees overlay close
          console.warn("Failed to send cancellation message (non-critical):", err.message);
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
    // Release pointer capture if still held
    if (activePointerId !== null && selectionOverlay) {
      try {
        selectionOverlay.releasePointerCapture(activePointerId);
      } catch {
        // Ignore - pointer may already be released
      }
      activePointerId = null;
    }
    if (selectionOverlay) selectionOverlay.remove();
    if (selectionBox) selectionBox.remove();
    if (instructionsPanel) instructionsPanel.remove();
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
    document.removeEventListener("keydown", handleKeyDown);
  }

  createOverlay();
})();
