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
      <div id="progressTrack">
        <div id="progressIndicator"></div>
      </div>
      <textarea id="output"></textarea>
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
    global.Tesseract = { createWorker: mockCreateWorker };

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

  describe("UI Elements", () => {
    it("should have status element", () => {
      expect(elements.statusEl).not.toBeNull();
    });

    it("should have output textarea", () => {
      expect(elements.outputEl).not.toBeNull();
    });

    it("should have screenshot button", () => {
      expect(elements.screenshotBtn).not.toBeNull();
    });

    it("should have region button", () => {
      expect(elements.regionBtn).not.toBeNull();
    });

    it("should have copy button", () => {
      expect(elements.copyBtn).not.toBeNull();
    });

    it("should have cancel button", () => {
      expect(elements.cancelBtn).not.toBeNull();
    });

    it("should have cancel button hidden by default", () => {
      expect(elements.cancelBtn.style.display).toBe("none");
    });
  });

  describe("Initial State", () => {
    it("should display 'Ready' status initially", () => {
      // Allow for async init to complete
      vi.runAllTimers();
      expect(elements.statusEl.textContent).toBe("Ready");
    });
  });

  describe("Screenshot Button Click", () => {
    it("should call captureVisibleTab and run OCR", async () => {
      vi.clearAllMocks();
      elements.screenshotBtn.click();
      await flushAll(); // Wait for promises to resolve

      expect(elements.statusEl.textContent).toBe("Done - 3 words, 20 chars (copied to clipboard)");
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalled();
      // Ensure Tesseract worker is created and recognize is called
      expect(mockCreateWorker).toHaveBeenCalled();
      expect(mockWorkerInstance.recognize).toHaveBeenCalledWith(expect.any(File));
      expect(elements.statusEl.textContent).toContain("Done");
      expect(elements.outputEl.value).toBe("Mock recognized text");
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Mock recognized text");
    });

    it("should handle error during screenshot capture", async () => {
      vi.clearAllMocks();
      chrome.tabs.captureVisibleTab.mockRejectedValueOnce(new Error("Capture failed"));

      elements.screenshotBtn.click();
      await flushAll();

      expect(elements.statusEl.textContent).toContain("Error: Capture failed");
      expect(elements.screenshotBtn.disabled).toBe(false);
      expect(elements.regionBtn.disabled).toBe(false);
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

    it("should handle error during region selection", async () => {
      vi.clearAllMocks();
      chrome.tabs.query.mockReset(); // Clear default mock from beforeEach
      chrome.tabs.query.mockResolvedValueOnce([{ id: 1, url: "chrome://extensions", windowId: 1 }]); // Simulate restricted URL
      elements.regionBtn.click();
      await flushAll(); // Ensure all timers are flushed for status update

      expect(elements.statusEl.textContent).toContain("Error: Cannot select region on browser pages");
    });
  });

  describe("Copy Button Click", () => {
    it("should copy text from output to clipboard", async () => {
      vi.clearAllMocks();
      elements.outputEl.value = "Text to be copied";
      elements.copyBtn.click();
      await flushAll();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Text to be copied");
      expect(elements.statusEl.textContent).toBe("Copied to clipboard");
    });

    it("should show 'No text to copy' if output is empty", async () => {
      vi.clearAllMocks();
      elements.outputEl.value = "";
      elements.copyBtn.click();
      await vi.runAllTimers();

      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(elements.statusEl.textContent).toBe("No text to copy");
    });
  });

  describe("Cancel Button Click", () => {
    it("should terminate the worker and reset state", async () => {
      vi.clearAllMocks();

      // Make recognize hang so we can cancel it
      let resolveRecognize;
      const pendingPromise = new Promise((resolve) => {
        resolveRecognize = resolve;
      });
      mockWorkerInstance.recognize.mockReturnValue(pendingPromise);
      
      // Start an OCR process
      elements.screenshotBtn.click();
      
      // Flush just enough to get to the recognize call
      await Promise.resolve(); 
      await Promise.resolve(); 
      await Promise.resolve(); 
      await vi.runAllTimers();
      await Promise.resolve(); // Allow promise resolution after timer callback

      expect(elements.cancelBtn.style.display).toBe("flex"); // Button should be visible

      elements.cancelBtn.click();
      await flushAll();

      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
      expect(elements.statusEl.textContent).toBe("Cancelled");
      expect(elements.cancelBtn.style.display).toBe("none");
      expect(elements.screenshotBtn.disabled).toBe(false);
    });
  });

  describe("checkRegionMode", () => {
    let originalLocation;
    beforeEach(() => {
      // Save original window.location
      originalLocation = window.location;

      // Mock window.location for this test suite, allowing 'search' to be set directly
      Object.defineProperty(window, "location", {
        writable: true,
        value: { ...originalLocation, search: "?regionMode=true" },
      });
    });

    afterEach(() => {
      // Restore original window.location
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

      // Re-initialize init() to trigger checkRegionMode()
      init(elements);
      await flushAll(); // Allow microtasks initiated by init() to run

      expect(chrome.storage.local.get).toHaveBeenCalledWith("pendingRegionOcr");
      expect(chrome.storage.local.remove).toHaveBeenCalledWith("pendingRegionOcr");
      expect(mockCreateWorker).toHaveBeenCalled();
      expect(mockWorkerInstance.recognize).toHaveBeenCalled();
      expect(elements.outputEl.value).toBe("Mock recognized text");
      expect(elements.statusEl.textContent).toContain("Done");
    });

    it("should not process expired region data", async () => {
      vi.clearAllMocks();
      const mockExpiredRegionOcr = {
        dataUrl: "data:image/png;base64,regionImageData",
        rect: { x: 0, y: 0, width: 10, height: 10 },
        timestamp: Date.now() - 70000, // 70 seconds ago
      };
      chrome.storage.local.get.mockResolvedValueOnce({
        pendingRegionOcr: mockExpiredRegionOcr,
      });

      init(elements);
      await flushAll();

      expect(chrome.storage.local.get).toHaveBeenCalledWith("pendingRegionOcr");
      expect(chrome.storage.local.remove).toHaveBeenCalledWith("pendingRegionOcr");
      expect(mockCreateWorker).not.toHaveBeenCalled();
      expect(elements.statusEl.textContent).toBe("Region data expired, please try again");
    });

    it("should handle error during region processing", async () => {
      vi.clearAllMocks();
      
      // Override Image to fail loading for this test
      const OriginalImage = global.Image;
      global.Image = class {
        constructor() {
          this.onload = null;
          this.onerror = null;
          this._src = "";
        }
        set src(val) {
          this._src = val;
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error("Load failed"));
          }, 0);
        }
      };

      const mockPendingRegionOcr = {
        dataUrl: "invalid-data-url",
        rect: { x: 0, y: 0, width: 10, height: 10 },
        timestamp: Date.now(),
      };
      chrome.storage.local.get.mockResolvedValueOnce({
        pendingRegionOcr: mockPendingRegionOcr,
      });

      init(elements);
      await flushAll(); // Allow microtasks initiated by init() to run

      expect(elements.statusEl.textContent).toContain("Error:");
      
      // Restore Image
      global.Image = OriginalImage;
    });
  });
});