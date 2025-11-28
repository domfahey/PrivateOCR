import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { init } from "../src/popup-logic.js";

// Mock Chrome APIs
global.chrome = {
  tabs: {
    query: vi.fn(), // Will be mocked per test in beforeEach for specific scenarios
    captureVisibleTab: vi.fn(() => Promise.resolve("data:image/png;base64,mockedImageData")),
  },
  scripting: {
    executeScript: vi.fn(() => Promise.resolve()),
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    },
  },
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://mocked-extension-id/${path}`),
  },
};

// Declare mockCreateWorker, mockRecognize, mockTerminate, and mockWorkerInstance at the top level for hoisting safety
let mockCreateWorker;
let mockRecognize;
let mockTerminate;
let mockWorkerInstance;

// Mock navigator.clipboard is already handled in setup.js

// Helper to flush promises and timers
async function flushAll() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    await vi.runAllTimers();
  }
}

describe("Popup Logic Integration", () => {
  let elements;

  beforeEach(() => {
    vi.useFakeTimers(); // Enable fake timers
    // Ensure chrome.tabs.query returns a tab with a valid URL for these tests
    global.chrome.tabs.query.mockResolvedValueOnce([{ id: 1, url: "https://example.com", windowId: 1 }]);
    document.body.innerHTML = `
      <div id="status"></div>
      <div class="view-options">
        <input type="checkbox" id="showPreviewCheckbox" />
      </div>
      <div id="contentArea">
        <div id="imagePreviewContainer">
          <img id="previewImage" />
        </div>
        <div class="text-field-wrapper">
          <textarea id="output"></textarea>
        </div>
      </div>
      <div id="progressTrack">
        <div id="progressIndicator"></div>
      </div>
      <button id="screenshotBtn">OCR current tab</button>
      <button id="regionBtn">Select region</button>
      <button id="copyBtn">Copy text</button>
      <button id="cancelBtn" style="display:none">Cancel</button>
    `;

    elements = {
      statusEl: document.getElementById("status"),
      outputEl: document.getElementById("output"),
      screenshotBtn: document.getElementById("screenshotBtn"),
      regionBtn: document.getElementById("regionBtn"),
      copyBtn: document.getElementById("copyBtn"),
      cancelBtn: document.getElementById("cancelBtn"),
      progressTrack: document.getElementById("progressTrack"),
      progressIndicator: document.getElementById("progressIndicator"),
      previewImage: document.getElementById("previewImage"),
      contentArea: document.getElementById("contentArea"),
      showPreviewCheckbox: document.getElementById("showPreviewCheckbox"),
    };
    elements.statusEl.textContent = "Ready"; // Initialize status text to match HTML

    // Setup global Tesseract mock
    mockRecognize = vi.fn(() => Promise.resolve({ data: { text: "Mock recognized text" } }));
    mockTerminate = vi.fn(() => Promise.resolve());
    mockWorkerInstance = {
      recognize: mockRecognize,
      terminate: mockTerminate,
    };
    mockCreateWorker = vi.fn(() => Promise.resolve(mockWorkerInstance));
    global.Tesseract = {
      createWorker: mockCreateWorker,
      OEM: { LSTM_ONLY: 1 },
    };

    init(elements);
    vi.runOnlyPendingTimers(); // Process initial timers set by init

    // Clear mocks after init to ensure clean state for tests, including Tesseract mocks
    vi.clearAllMocks();

    // Mock Image for scaleImageIfNeeded and cropImageToRegion
    global.Image = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.width = 100;
        this.height = 100;
        this._src = "";
      }
      get src() { return this._src; }
      set src(val) {
        this._src = val;
        // Trigger onload asynchronously to simulate browser behavior
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    };
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers after each test
  });

  // ... existing tests ...
  describe("UI Elements", () => {
    it("should have new UI elements", () => {
      expect(elements.previewImage).not.toBeNull();
      expect(elements.contentArea).not.toBeNull();
      expect(elements.showPreviewCheckbox).not.toBeNull();
    });
  });

  describe("Screenshot Button Click", () => {
    it("should call captureVisibleTab and run OCR", async () => {
      vi.clearAllMocks();
      elements.screenshotBtn.click();
      await flushAll();

      expect(elements.statusEl.textContent).toBe("Done - 3 words, 20 chars (copied to clipboard)");
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalled();
      expect(mockCreateWorker).toHaveBeenCalled();
      expect(mockWorkerInstance.recognize).toHaveBeenCalledWith(expect.any(File));
    });

    it("should update preview if checkbox is checked", async () => {
        vi.clearAllMocks();
        elements.showPreviewCheckbox.checked = true;
        elements.screenshotBtn.click();
        await flushAll();

        expect(elements.contentArea.classList.contains("split-view")).toBe(true);
        expect(elements.previewImage.src).toContain("data:image/png;base64");
    });
  });

  describe("Region Button Click", () => {
    it("should call executeScript and close window", async () => {
      vi.clearAllMocks();

      elements.regionBtn.click();
      await flushAll();

      expect(elements.statusEl.textContent).toBe("Select a region on the page...");
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        files: ["src/content.js"],
      });
      expect(window.close).toHaveBeenCalled();
    });
  });

  describe("Copy Button Click", () => {
    it("should copy text from output to clipboard", async () => {
      vi.clearAllMocks();
      elements.outputEl.value = "Text to be copied";
      elements.copyBtn.click();
      await flushAll();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Text to be copied");
    });
  });

  describe("Cancel Button Click", () => {
    it("should terminate the worker and reset state", async () => {
      vi.clearAllMocks();

      let resolveRecognize;
      const pendingPromise = new Promise((resolve) => {
        resolveRecognize = resolve;
      });
      mockWorkerInstance.recognize.mockReturnValue(pendingPromise);
      
      elements.screenshotBtn.click();
      
      await Promise.resolve(); 
      await Promise.resolve(); 
      await Promise.resolve(); 
      await vi.runAllTimers();
      await Promise.resolve();

      expect(elements.cancelBtn.style.display).toBe("flex"); 

      elements.cancelBtn.click();
      await flushAll();

      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
      expect(elements.statusEl.textContent).toBe("Cancelled");
    });
  });

  describe("checkRegionMode", () => {
    let originalLocation;
    beforeEach(() => {
      originalLocation = window.location;
      Object.defineProperty(window, "location", {
        writable: true,
        value: { ...originalLocation, search: "?regionMode=true" },
      });
    });

    afterEach(() => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: originalLocation,
      });
    });

    it("should process pending region OCR data", async () => {
      vi.clearAllMocks();
      const mockPendingRegionOcr = {
        dataUrl: "data:image/png;base64,regionImageData",
        rect: { x: 0, y: 0, width: 10, height: 10 },
        timestamp: Date.now(),
      };
      chrome.storage.local.get.mockResolvedValueOnce({
        pendingRegionOcr: mockPendingRegionOcr,
      });

      init(elements);
      await flushAll();

      expect(chrome.storage.local.get).toHaveBeenCalledWith("pendingRegionOcr");
      expect(mockCreateWorker).toHaveBeenCalled();
      expect(mockWorkerInstance.recognize).toHaveBeenCalled();
    });
  });
});
