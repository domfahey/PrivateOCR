// Background service worker for region selection coordination

chrome.runtime.onMessage.addListener((message, sender, _sendResponse) => {
  if (message.type === "regionSelected") {
    handleRegionSelection(sender.tab, message.rect);
  }
});

/**
 * Handle the region selection message from the content script.
 * Captures the tab, stores data, and opens the popup to process the region.
 * @param {chrome.tabs.Tab} tab - The tab where selection occurred
 * @param {Object} rect - The selected region coordinates (scaled for DPI)
 */
async function handleRegionSelection(tab, rect) {
  try {
    // Capture the visible tab
    // This must be done in background/popup context, not content script
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    // Store the capture data for the popup to retrieve
    // We use storage instead of URL parameters because data URLs can be very large
    await chrome.storage.local.set({
      pendingRegionOcr: {
        dataUrl: dataUrl,
        rect: rect,
        timestamp: Date.now(),
      },
    });

    // Open the popup programmatically by opening a new window with popup.html
    // Note: chrome.action.openPopup() is not available in background service workers
    // So we'll open the extension popup as a small independent window
    chrome.windows.create({
      url: chrome.runtime.getURL("src/popup.html") + "?regionMode=true",
      type: "popup",
      width: 400,
      height: 400,
    });
  } catch (err) {
    console.error("Error capturing region:", err);
  }
}
