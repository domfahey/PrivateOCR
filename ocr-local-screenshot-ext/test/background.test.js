/**
 * Tests for background service worker
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Background Service Worker", () => {
  let messageHandler;

  beforeEach(() => {
    // Capture the message listener when background.js is loaded
    chrome.runtime.onMessage.addListener = vi.fn((handler) => {
      messageHandler = handler;
    });

    vi.resetModules();
  });

  describe("Message Handling", () => {
    it("should register a message listener on load", async () => {
      await import("../src/background.js");

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(messageHandler).toBeDefined();
    });
  });

  describe("Region Selection Flow", () => {
    beforeEach(async () => {
      await import("../src/background.js");
    });

    it("should capture visible tab when regionSelected message is received", async () => {
      const mockTab = { id: 1, windowId: 1 };
      const mockRect = { x: 0, y: 0, width: 100, height: 100 };

      messageHandler({ type: "regionSelected", rect: mockRect }, { tab: mockTab }, vi.fn());

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(mockTab.windowId, {
        format: "png",
      });
    });

    it("should store captured data in chrome.storage.local", async () => {
      const mockTab = { id: 1, windowId: 1 };
      const mockRect = { x: 10, y: 20, width: 200, height: 150 };

      messageHandler({ type: "regionSelected", rect: mockRect }, { tab: mockTab }, vi.fn());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingRegionOcr: expect.objectContaining({
            rect: mockRect,
            dataUrl: expect.any(String),
            timestamp: expect.any(Number),
          }),
        })
      );
    });

    it("should store source tab ID and window ID for region mode popup", async () => {
      const mockTab = { id: 42, windowId: 10 };
      const mockRect = { x: 0, y: 0, width: 100, height: 100 };

      messageHandler({ type: "regionSelected", rect: mockRect }, { tab: mockTab }, vi.fn());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingRegionOcr: expect.objectContaining({
            sourceTabId: 42,
            sourceWindowId: 10,
          }),
        })
      );
    });

    it("should open popup window with adequate size for UI", async () => {
      const mockTab = { id: 1, windowId: 1 };
      const mockRect = { x: 0, y: 0, width: 100, height: 100 };

      messageHandler({ type: "regionSelected", rect: mockRect }, { tab: mockTab }, vi.fn());

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Popup must be at least 800x600 to accommodate min-width: 780px and min-height: 580px
      expect(chrome.windows.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("popup.html?regionMode=true"),
          type: "popup",
          width: 800,
          height: 600,
        })
      );
    });

    it("should not process non-regionSelected messages", async () => {
      messageHandler({ type: "unknownMessage" }, { tab: { id: 1, windowId: 1 } }, vi.fn());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle captureVisibleTab errors gracefully", async () => {
      chrome.tabs.captureVisibleTab = vi.fn().mockRejectedValue(new Error("Capture failed"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      vi.resetModules();
      await import("../src/background.js");

      const mockTab = { id: 1, windowId: 1 };
      const mockRect = { x: 0, y: 0, width: 100, height: 100 };

      messageHandler({ type: "regionSelected", rect: mockRect }, { tab: mockTab }, vi.fn());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith("Error capturing region:", expect.any(Error));
      consoleSpy.mockRestore();
    });

    it("should show notification when capture fails", async () => {
      chrome.tabs.captureVisibleTab = vi.fn().mockRejectedValue(new Error("Capture failed"));

      vi.resetModules();
      await import("../src/background.js");

      const mockTab = { id: 1, windowId: 1 };
      const mockRect = { x: 0, y: 0, width: 100, height: 100 };

      messageHandler({ type: "regionSelected", rect: mockRect }, { tab: mockTab }, vi.fn());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "basic",
          title: expect.stringContaining("Error"),
          message: expect.stringContaining("Capture failed"),
        })
      );
    });
  });

  describe("Storage Cleanup", () => {
    it("should clean up stale region data on startup", async () => {
      // Setup stale data (older than 60 seconds)
      const staleData = {
        pendingRegionOcr: {
          dataUrl: "data:image/png;base64,oldData",
          rect: { x: 0, y: 0, width: 100, height: 100 },
          timestamp: Date.now() - 120000, // 2 minutes old
        },
      };
      chrome.storage.local.get.mockResolvedValueOnce(staleData);

      vi.resetModules();
      await import("../src/background.js");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.storage.local.remove).toHaveBeenCalledWith("pendingRegionOcr");
    });

    it("should not clean up fresh region data on startup", async () => {
      // Setup fresh data (less than 60 seconds old)
      const freshData = {
        pendingRegionOcr: {
          dataUrl: "data:image/png;base64,freshData",
          rect: { x: 0, y: 0, width: 100, height: 100 },
          timestamp: Date.now() - 30000, // 30 seconds old
        },
      };
      chrome.storage.local.get.mockResolvedValueOnce(freshData);
      chrome.storage.local.remove.mockClear();

      vi.resetModules();
      await import("../src/background.js");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    });

    it("should handle storage errors gracefully during cleanup", async () => {
      // Mock storage.local.get to throw an error
      chrome.storage.local.get.mockRejectedValueOnce(new Error("Storage error"));

      vi.resetModules();

      // Should not throw, just silently ignore the error
      await expect(import("../src/background.js")).resolves.not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should not clean up when no pending data exists", async () => {
      // No pending data
      chrome.storage.local.get.mockResolvedValueOnce({});
      chrome.storage.local.remove.mockClear();

      vi.resetModules();
      await import("../src/background.js");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    });
  });

  describe("MV3 Service Worker Lifecycle", () => {
    it("should return true from message listener for async handlers", async () => {
      vi.resetModules();

      // Capture the return value of the message listener
      let listenerReturnValue;
      chrome.runtime.onMessage.addListener = vi.fn((handler) => {
        messageHandler = handler;
        // When we call the handler, capture its return value
      });

      await import("../src/background.js");

      const mockTab = { id: 1, windowId: 1 };
      const mockRect = { x: 0, y: 0, width: 100, height: 100 };

      // The listener should return true to indicate async response
      listenerReturnValue = messageHandler(
        { type: "regionSelected", rect: mockRect },
        { tab: mockTab },
        vi.fn()
      );

      // MV3 requires returning true for async message handlers to keep the channel open
      expect(listenerReturnValue).toBe(true);
    });
  });

  describe("Sender Validation", () => {
    it("should handle missing sender.tab gracefully", async () => {
      vi.resetModules();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await import("../src/background.js");

      // Send message with no tab (e.g., from popup or other context)
      messageHandler(
        { type: "regionSelected", rect: { x: 0, y: 0, width: 100, height: 100 } },
        {}, // No tab property
        vi.fn()
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw, should log error or show notification
      expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle undefined sender gracefully", async () => {
      vi.resetModules();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await import("../src/background.js");

      // This should not throw
      expect(() => {
        messageHandler(
          { type: "regionSelected", rect: { x: 0, y: 0, width: 100, height: 100 } },
          undefined,
          vi.fn()
        );
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe("Region Cancellation", () => {
    it("should show notification when Escape cancels selection", async () => {
      await import("../src/background.js");

      messageHandler({ type: "regionCancelled", reason: "escape" }, { tab: { id: 1 } }, vi.fn());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "basic",
          title: "Selection Cancelled",
          message: expect.stringContaining("Escape"),
        })
      );
    });

    it("should show notification when selection is too small", async () => {
      await import("../src/background.js");

      messageHandler({ type: "regionCancelled", reason: "tooSmall" }, { tab: { id: 1 } }, vi.fn());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "basic",
          title: "Selection Too Small",
          message: expect.stringContaining("10x10 pixels"),
        })
      );
    });

    it("should not show notification for unknown cancellation reasons", async () => {
      await import("../src/background.js");
      chrome.notifications.create.mockClear();

      messageHandler({ type: "regionCancelled", reason: "unknown" }, { tab: { id: 1 } }, vi.fn());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.notifications.create).not.toHaveBeenCalled();
    });
  });
});
