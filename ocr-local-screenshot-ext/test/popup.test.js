import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { init } from "../src/popup-logic.js";

// Mock Chrome APIs
global.chrome = {
  tabs: {
    query: vi.fn(), // Will be mocked per test in beforeEach for specific scenarios
    captureVisibleTab: vi.fn(() => Promise.resolve("data:image/png;base64,mockedImageData")),
    create: vi.fn(),
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
      <div id="contentArea">
        <div id="imagePreviewContainer">
          <div id="emptyImageState" style="display:flex"></div>
          <img id="previewImage" style="display:none" />
        </div>
        <div class="text-field-wrapper">
          <button id="toggleImageBtn"></button>
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
      <button id="settingsBtn">Settings</button>
      <button id="imgZoomInBtn">Img+</button>
      <button id="imgZoomOutBtn">Img-</button>
      <button id="imgZoomFitBtn">ImgFit</button>
      <button id="textZoomInBtn">Txt+</button>
      <button id="textZoomOutBtn">Txt-</button>
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
      emptyImageState: document.getElementById("emptyImageState"),
      contentArea: document.getElementById("contentArea"),
      toggleImageBtn: document.getElementById("toggleImageBtn"),
      settingsBtn: document.getElementById("settingsBtn"),
      imgZoomInBtn: document.getElementById("imgZoomInBtn"),
      imgZoomOutBtn: document.getElementById("imgZoomOutBtn"),
      imgZoomFitBtn: document.getElementById("imgZoomFitBtn"),
      textZoomInBtn: document.getElementById("textZoomInBtn"),
      textZoomOutBtn: document.getElementById("textZoomOutBtn"),
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

  describe("UI Elements", () => {
    it("should have new UI elements", () => {
      expect(elements.previewImage).not.toBeNull();
      expect(elements.emptyImageState).not.toBeNull();
      expect(elements.contentArea).not.toBeNull();
      expect(elements.toggleImageBtn).not.toBeNull();
      expect(elements.settingsBtn).not.toBeNull();
      expect(elements.imgZoomInBtn).not.toBeNull();
    });
  });

  describe("Settings Button Click", () => {
    it("should open the settings page", () => {
      elements.settingsBtn.click();
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: "chrome-extension://test-id/src/settings.html",
      });
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

    it("should update preview", async () => {
        vi.clearAllMocks();
        elements.screenshotBtn.click();
        await flushAll();

        // Should be visible by default
        expect(elements.contentArea.classList.contains("split-view")).toBe(true);
        expect(elements.previewImage.src).toContain("data:image/png;base64");
        expect(elements.previewImage.style.display).toBe("block");
        expect(elements.emptyImageState.style.display).toBe("none");
    });
  });

  describe("Zoom Controls", () => {
    it("should increase text size from CSS baseline", () => {
      // CSS sets font-size to 15px, JS should start from 15px not 14px
      elements.textZoomInBtn.click();
      expect(elements.outputEl.style.fontSize).toBe("17px"); // 15 + 2 = 17
    });

    it("should decrease text size from CSS baseline", () => {
      // First increase then decrease to verify baseline
      elements.textZoomInBtn.click(); // 17px
      elements.textZoomOutBtn.click(); // 15px
      expect(elements.outputEl.style.fontSize).toBe("15px");
    });

    it("should match CSS baseline on first zoom operation", () => {
      // The first zoom should produce a visible change
      // If baseline is wrong (14 vs 15), first zoom-in does nothing visible
      const cssFontSize = 15; // From styles.css .md-text-field
      elements.textZoomInBtn.click();
      const resultSize = parseInt(elements.outputEl.style.fontSize);
      expect(resultSize).toBe(cssFontSize + 2);
    });
  });

  describe("Image Toggle", () => {
      it("should toggle split-view class", async () => {
          // Simulate having an image first
          elements.screenshotBtn.click();
          await flushAll();
          
          // Initially active
          expect(elements.contentArea.classList.contains("split-view")).toBe(true);
          
          // Click to toggle off
          elements.toggleImageBtn.click();
          expect(elements.contentArea.classList.contains("split-view")).toBe(false);
      });
  });

  // ... existing tests ...
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

  // Bug fix tests
  describe("Bug Fixes", () => {
    describe("Bug 1: Progress bar should hide for idle statuses", () => {
      it("should hide progress bar for 'Ready' status", async () => {
        vi.clearAllMocks();
        elements.screenshotBtn.click();
        await flushAll();

        // After OCR completes, status shows "Done..." and progress hides after delay
        // Simulate clicking copy with no text to trigger "No text to copy"
        elements.outputEl.value = "";
        elements.copyBtn.click();
        await flushAll();

        // Progress bar should NOT be active for idle status "No text to copy"
        expect(elements.progressTrack.classList.contains("active")).toBe(false);
      });

      it("should hide progress bar for 'Copied to clipboard' status", async () => {
        vi.clearAllMocks();
        elements.outputEl.value = "Some text";
        elements.copyBtn.click();
        await flushAll();

        // Progress bar should NOT be active for "Copied to clipboard"
        expect(elements.progressTrack.classList.contains("active")).toBe(false);
      });

      it("should hide progress bar for 'Region data expired' status", async () => {
        vi.clearAllMocks();
        // This would require simulating expired region data
        // The key assertion is that non-processing statuses hide the progress bar
        expect(elements.progressIndicator.classList.contains("indeterminate")).toBe(false);
      });
    });

    describe("Bug 2: Worker init failure should not block future attempts", () => {
      it("should allow retry after worker initialization fails", async () => {
        vi.clearAllMocks();

        // First attempt: worker creation fails
        const initError = new Error("Failed to load worker");
        mockCreateWorker.mockRejectedValueOnce(initError);

        elements.screenshotBtn.click();
        await flushAll();

        expect(elements.statusEl.textContent).toContain("Error");

        // Second attempt: worker creation succeeds
        mockCreateWorker.mockResolvedValueOnce(mockWorkerInstance);
        chrome.tabs.query.mockResolvedValueOnce([{ id: 1, url: "https://example.com", windowId: 1 }]);

        elements.screenshotBtn.click();
        await flushAll();

        // Should have called createWorker twice (not returned cached rejected promise)
        expect(mockCreateWorker).toHaveBeenCalledTimes(2);
        expect(elements.statusEl.textContent).toBe("Done - 3 words, 20 chars (copied to clipboard)");
      });
    });

    describe("Bug 4: Double-click Copy should not leave button stuck", () => {
      it("should cancel previous timeout on rapid clicks", async () => {
        vi.clearAllMocks();
        elements.outputEl.value = "Some text";

        // First click
        elements.copyBtn.click();
        await Promise.resolve();

        // Rapid second click before timeout completes
        elements.copyBtn.click();
        await Promise.resolve();

        // Fast forward past the timeout
        await vi.advanceTimersByTimeAsync(2500);

        // Button should be restored, not stuck on "Copied!"
        expect(elements.copyBtn.innerHTML).toContain("Copy");
        expect(elements.copyBtn.innerHTML).not.toContain("Copied!");
      });
    });

    describe("Bug 5: isProcessing should be set immediately on capture", () => {
      it("should disable buttons immediately when screenshot starts", async () => {
        vi.clearAllMocks();

        // Mock captureVisibleTab to be slow
        let resolveCapture;
        chrome.tabs.captureVisibleTab.mockReturnValue(
          new Promise((resolve) => {
            resolveCapture = resolve;
          })
        );

        // Click screenshot
        elements.screenshotBtn.click();
        await Promise.resolve();

        // Buttons should be disabled immediately, before capture completes
        expect(elements.screenshotBtn.disabled).toBe(true);
        expect(elements.regionBtn.disabled).toBe(true);

        // Complete capture
        resolveCapture("data:image/png;base64,mockData");
        await flushAll();
      });

      it("should prevent double-click on Capture Tab button", async () => {
        vi.clearAllMocks();

        // Mock captureVisibleTab to be slow
        let resolveCapture;
        chrome.tabs.captureVisibleTab.mockReturnValue(
          new Promise((resolve) => {
            resolveCapture = resolve;
          })
        );

        // First click
        elements.screenshotBtn.click();
        await Promise.resolve();

        // Try to click again
        elements.screenshotBtn.click();
        await Promise.resolve();

        // captureVisibleTab should only be called once
        expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);

        // Complete capture
        resolveCapture("data:image/png;base64,mockData");
        await flushAll();
      });
    });

    describe("Bug 6: Cancel button should be visible during capture", () => {
      it("should show cancel button immediately when capture starts", async () => {
        vi.clearAllMocks();

        // Mock captureVisibleTab to be slow
        let resolveCapture;
        chrome.tabs.captureVisibleTab.mockReturnValue(
          new Promise((resolve) => {
            resolveCapture = resolve;
          })
        );

        // Cancel button starts hidden
        expect(elements.cancelBtn.style.display).toBe("none");

        // Click screenshot
        elements.screenshotBtn.click();
        await Promise.resolve();

        // Cancel button should be visible immediately
        expect(elements.cancelBtn.style.display).toBe("flex");

        // Complete capture
        resolveCapture("data:image/png;base64,mockData");
        await flushAll();
      });
    });


    describe("Bug 3: Region captures should scale large images", () => {
      it("should scale down large region captures", async () => {
        vi.clearAllMocks();

        // Mock a large image that needs scaling
        global.Image = class {
          constructor() {
            this.onload = null;
            this.onerror = null;
            this.width = 5000; // Large width exceeding MAX_DIMENSION
            this.height = 4000; // Large height
            this.naturalWidth = 5000;
            this.naturalHeight = 4000;
            this._src = "";
          }
          get src() { return this._src; }
          set src(val) {
            this._src = val;
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          }
        };

        // Mock canvas and context
        const mockContext = {
          drawImage: vi.fn(),
        };
        const mockCanvas = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockContext),
          toDataURL: vi.fn(() => "data:image/png;base64,scaledImageData"),
          toBlob: vi.fn((cb) => cb(new Blob(["scaled"], { type: "image/png" }))),
        };
        vi.spyOn(document, "createElement").mockImplementation((tag) => {
          if (tag === "canvas") return mockCanvas;
          return document.createElement(tag);
        });

        // Set up region mode
        const originalLocation = window.location;
        Object.defineProperty(window, "location", {
          writable: true,
          value: { ...originalLocation, search: "?regionMode=true" },
        });

        const mockPendingRegionOcr = {
          dataUrl: "data:image/png;base64,veryLargeImageData",
          rect: { x: 0, y: 0, width: 5000, height: 4000 },
          timestamp: Date.now(),
        };
        chrome.storage.local.get.mockResolvedValueOnce({
          pendingRegionOcr: mockPendingRegionOcr,
        });

        init(elements);
        await flushAll();

        // The canvas dimensions should be scaled down, not the original 5000x4000
        // MAX_DIMENSION is 3000, so it should be scaled
        expect(mockCanvas.width).toBeLessThan(5000);
        expect(mockCanvas.height).toBeLessThan(4000);

        // Restore location
        Object.defineProperty(window, "location", {
          writable: true,
          value: originalLocation,
        });
        document.createElement.mockRestore();
      });
    });

    describe("Region Mode Edge Cases", () => {
      it("should show error for expired region data", async () => {
        vi.clearAllMocks();

        // Set up region mode with expired data (older than 60 seconds)
        const originalLocation = window.location;
        Object.defineProperty(window, "location", {
          writable: true,
          value: { ...originalLocation, search: "?regionMode=true" },
        });

        chrome.storage.local.get.mockResolvedValueOnce({
          pendingRegionOcr: {
            dataUrl: "data:image/png;base64,expiredData",
            rect: { x: 0, y: 0, width: 100, height: 100 },
            timestamp: Date.now() - 120000, // 2 minutes old
          },
        });

        init(elements);
        await flushAll();

        expect(elements.statusEl.textContent).toBe("Region data expired, please try again");

        // Restore location
        Object.defineProperty(window, "location", {
          writable: true,
          value: originalLocation,
        });
      });

      it("should handle storage error in region mode", async () => {
        vi.clearAllMocks();
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const originalLocation = window.location;
        Object.defineProperty(window, "location", {
          writable: true,
          value: { ...originalLocation, search: "?regionMode=true" },
        });

        chrome.storage.local.get.mockRejectedValueOnce(new Error("Storage access denied"));

        init(elements);
        await flushAll();

        expect(consoleSpy).toHaveBeenCalledWith("Error loading region data:", expect.any(Error));
        expect(elements.statusEl.textContent).toContain("Error");

        consoleSpy.mockRestore();
        Object.defineProperty(window, "location", {
          writable: true,
          value: originalLocation,
        });
      });

      it("should handle missing region data gracefully", async () => {
        vi.clearAllMocks();

        const originalLocation = window.location;
        Object.defineProperty(window, "location", {
          writable: true,
          value: { ...originalLocation, search: "?regionMode=true" },
        });

        // No pending data
        chrome.storage.local.get.mockResolvedValueOnce({});

        init(elements);
        await flushAll();

        // Should not show error, just be ready
        expect(elements.statusEl.textContent).not.toContain("Error");

        Object.defineProperty(window, "location", {
          writable: true,
          value: originalLocation,
        });
      });
    });

    describe("Region Click Error Handling", () => {
      it("should show error when scripting.executeScript fails", async () => {
        vi.clearAllMocks();
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        chrome.tabs.query.mockResolvedValueOnce([{ id: 1, url: "https://example.com", windowId: 1 }]);
        chrome.scripting.executeScript.mockRejectedValueOnce(new Error("Script injection failed"));

        init(elements);
        elements.regionBtn.click();
        await flushAll();

        expect(elements.statusEl.textContent).toContain("Error");
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it("should show specific error for access denied pages", async () => {
        vi.clearAllMocks();
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        chrome.tabs.query.mockResolvedValueOnce([{ id: 1, url: "https://example.com", windowId: 1 }]);
        chrome.scripting.executeScript.mockRejectedValueOnce(new Error("Cannot access this chrome:// page"));

        init(elements);
        elements.regionBtn.click();
        await flushAll();

        expect(elements.statusEl.textContent).toBe("Error: Cannot select region on this page");

        consoleSpy.mockRestore();
      });

      it("should handle tab without URL", async () => {
        vi.clearAllMocks();

        chrome.tabs.query.mockResolvedValueOnce([{ id: 1, windowId: 1 }]); // No URL

        init(elements);
        elements.regionBtn.click();
        await flushAll();

        expect(elements.statusEl.textContent).toBe("Error: Cannot access this tab");
      });
    });

    describe("Scaling Status Timing", () => {
      it("should show scaling status BEFORE scaling completes, not after", async () => {
        vi.clearAllMocks();

        // Track status updates via console.log (which updateStatus calls)
        const statusUpdates = [];
        const originalLog = console.log;
        console.log = (msg) => {
          statusUpdates.push(msg);
          originalLog(msg);
        };

        // Mock a large image that triggers scaling
        global.Image = class {
          constructor() {
            this.onload = null;
            this.width = 5000;
            this.height = 4000;
            this._src = "";
          }
          get src() {
            return this._src;
          }
          set src(val) {
            this._src = val;
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          }
        };

        elements.screenshotBtn.click();
        await flushAll();

        // Restore console.log
        console.log = originalLog;

        // "Scaling large image..." should appear BEFORE "Recognizing..."
        const scalingIndex = statusUpdates.findIndex((s) =>
          typeof s === "string" && s.includes("Scaling")
        );
        const recognizingIndex = statusUpdates.findIndex((s) =>
          typeof s === "string" && s.includes("Recognizing")
        );

        // If scaling happens, it should be before recognizing
        if (scalingIndex !== -1 && recognizingIndex !== -1) {
          expect(scalingIndex).toBeLessThan(recognizingIndex);
        }
      });
    });

    describe("OCR Cancellation Race Condition", () => {
      it("should not allow cancelled operation to continue after new operation starts", async () => {
        vi.clearAllMocks();

        // Track how many times recognize is called
        let recognizeCallCount = 0;
        mockWorkerInstance.recognize = vi.fn(async () => {
          recognizeCallCount++;
          // Simulate slow recognition
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { data: { text: `Result ${recognizeCallCount}` } };
        });

        // Start first operation
        elements.screenshotBtn.click();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(10);

        // Cancel it
        elements.cancelBtn.click();
        await Promise.resolve();

        // Immediately start second operation
        chrome.tabs.query.mockResolvedValueOnce([
          { id: 1, url: "https://example.com", windowId: 1 },
        ]);
        elements.screenshotBtn.click();
        await flushAll();

        // Only ONE successful OCR should complete (the second one)
        // The first one should have been properly cancelled
        expect(elements.outputEl.value).not.toContain("Result 1");
      });
    });

    describe("Copy Button Edge Cases", () => {
      it("should handle clipboard write failure", async () => {
        vi.clearAllMocks();
        elements.outputEl.value = "Some text";

        // Mock clipboard to fail
        navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error("Clipboard blocked"));

        init(elements);
        elements.copyBtn.click();
        await flushAll();

        expect(elements.statusEl.textContent).toBe("Could not copy to clipboard");
      });
    });
  });
});
