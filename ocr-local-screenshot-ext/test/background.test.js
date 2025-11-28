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

    it("should open popup window after capturing", async () => {
      const mockTab = { id: 1, windowId: 1 };
      const mockRect = { x: 0, y: 0, width: 100, height: 100 };

      messageHandler({ type: "regionSelected", rect: mockRect }, { tab: mockTab }, vi.fn());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.windows.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("popup.html?regionMode=true"),
          type: "popup",
          width: 400,
          height: 400,
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
  });
});
