/**
 * Background Service Worker for PrivateOCR
 *
 * Handles communication between the content script (region selection)
 * and the popup. This service worker is necessary because content scripts
 * cannot directly call chrome.tabs.captureVisibleTab.
 *
 * Flow:
 * 1. content.js sends "regionSelected" message with coordinates
 * 2. This worker captures the visible tab as a screenshot
 * 3. Screenshot + coordinates are stored in chrome.storage.local
 * 4. A new popup window is opened with ?regionMode=true
 * 5. popup-logic.js retrieves the data and performs OCR on the region
 *
 * @module background
 */

/**
 * Clean up stale region data on startup.
 * This handles the case where region data was stored but the popup never opened.
 */
async function cleanupStaleData() {
  try {
    const result = await chrome.storage.local.get("pendingRegionOcr");
    if (result.pendingRegionOcr) {
      const { timestamp } = result.pendingRegionOcr;
      // Remove data older than 60 seconds
      if (Date.now() - timestamp >= 60000) {
        await chrome.storage.local.remove("pendingRegionOcr");
      }
    }
  } catch (err) {
    // Log cleanup errors but don't fail - this is non-critical maintenance
    console.warn("Stale data cleanup failed (non-critical):", err.message);
  }
}

// Run cleanup on service worker startup
cleanupStaleData();

/**
 * Listen for messages from content scripts.
 * Currently handles "regionSelected" messages from the region selection overlay.
 */
chrome.runtime.onMessage.addListener((message, sender, _sendResponse) => {
  if (message.type === "regionSelected") {
    // Validate sender.tab exists before processing
    if (!sender?.tab) {
      console.error("Region selection received without valid tab context");
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "Capture Error",
        message: "Could not identify the source tab. Please try again.",
      });
      return false;
    }
    handleRegionSelection(sender.tab, message.rect);
    // Return true to indicate async response (keeps message channel open for MV3)
    return true;
  } else if (message.type === "regionCancelled") {
    handleRegionCancelled(message.reason);
  }
  return false;
});

/**
 * Handle region selection cancellation.
 * Shows a notification to the user explaining why selection was cancelled.
 *
 * @param {string} reason - The reason for cancellation (e.g., "tooSmall", "escape")
 */
function handleRegionCancelled(reason) {
  if (reason === "tooSmall") {
    // Show a notification that selection was too small
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Selection Too Small",
      message: "Please drag a larger area (at least 10x10 pixels) to select a region for OCR.",
    });
  } else if (reason === "escape") {
    // Show a notification that selection was cancelled by user
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Selection Cancelled",
      message: "Region selection cancelled. Press Escape was detected.",
    });
  }
}

/**
 * Handle the region selection message from the content script.
 * Captures the tab, stores data, and opens the popup to process the region.
 *
 * @param {chrome.tabs.Tab} sourceTab - The tab where selection occurred
 * @param {Object} selectedRegion - The selected region coordinates (scaled for DPI)
 * @returns {Promise<void>}
 */
async function handleRegionSelection(sourceTab, selectedRegion) {
  try {
    // Capture the visible tab
    // This must be done in background/popup context, not content script
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(sourceTab.windowId, {
      format: "png",
    });

    // Store the capture data for the popup to retrieve
    // We use storage instead of URL parameters because data URLs can be very large
    // Include source tab info so the popup can capture from the original tab, not itself
    await chrome.storage.local.set({
      pendingRegionOcr: {
        dataUrl: screenshotDataUrl,
        rect: selectedRegion,
        timestamp: Date.now(),
        sourceTabId: sourceTab.id,
        sourceWindowId: sourceTab.windowId,
      },
    });

    // Open the popup programmatically by opening a new window with popup.html
    // Note: chrome.action.openPopup() is not available in background service workers
    // Size must accommodate min-width: 780px and min-height: 580px from styles.css
    chrome.windows.create({
      url: chrome.runtime.getURL("src/popup.html") + "?regionMode=true",
      type: "popup",
      width: 800,
      height: 600,
    });
  } catch (error) {
    console.error("Error capturing region:", error);
    // Show notification to user since popup may not open
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Capture Error",
      message: error.message || "Failed to capture the region. Please try again.",
    });
  }
}
