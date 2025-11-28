// Background service worker for region selection coordination

chrome.runtime.onMessage.addListener((message, sender, _sendResponse) => {
  if (message.type === "regionSelected") {
    handleRegionSelection(sender.tab, message.rect);
  }
});

async function handleRegionSelection(tab, rect) {
  try {
    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    // Store the capture data for the popup to retrieve
    await chrome.storage.local.set({
      pendingRegionOcr: {
        dataUrl: dataUrl,
        rect: rect,
        timestamp: Date.now(),
      },
    });

    // Open the popup programmatically by opening a new window with popup.html
    // Note: chrome.action.openPopup() is not available in all contexts
    // So we'll open the popup as a small window instead
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html") + "?regionMode=true",
      type: "popup",
      width: 400,
      height: 400,
    });
  } catch (err) {
    console.error("Error capturing region:", err);
  }
}
