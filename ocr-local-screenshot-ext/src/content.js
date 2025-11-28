// Region selection overlay for OCR
(function () {
  // Prevent multiple injections
  if (window.__ocrRegionSelectorActive) return;
  window.__ocrRegionSelectorActive = true;

  let overlay = null;
  let selectionBox = null;
  let instructions = null;
  let startX = 0;
  let startY = 0;
  let isSelecting = false;

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

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      cleanup();
    }
  }

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
