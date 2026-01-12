/**
 * Tests for content script (region selection overlay)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Content Script - Region Selection", () => {
  beforeEach(() => {
    // Reset the DOM
    document.body.innerHTML = "";
    // Reset the global flag
    delete window.__ocrRegionSelectorActive;
  });

  afterEach(() => {
    // Clean up any overlays
    document.querySelectorAll("div").forEach((el) => el.remove());
    delete window.__ocrRegionSelectorActive;
    vi.resetModules();
  });

  describe("Overlay Creation", () => {
    it("should create overlay when content script loads", async () => {
      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="position: fixed"]');
      expect(overlay).not.toBeNull();
    });

    it("should set __ocrRegionSelectorActive flag", async () => {
      await import("../src/content.js");

      expect(window.__ocrRegionSelectorActive).toBe(true);
    });

    it("should prevent multiple injections", async () => {
      await import("../src/content.js");
      vi.resetModules();
      await import("../src/content.js");

      // Should only have one overlay
      const overlays = document.querySelectorAll('div[style*="cursor: crosshair"]');
      expect(overlays.length).toBe(1);
    });

    it("should show instructions text", async () => {
      await import("../src/content.js");

      const instructions = document.body.textContent;
      expect(instructions).toContain("Click and drag");
    });
  });

  describe("Mouse Interaction", () => {
    it("should create selection box on mousedown", async () => {
      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="cursor: crosshair"]');

      const mousedownEvent = new MouseEvent("mousedown", {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      overlay.dispatchEvent(mousedownEvent);

      const selectionBox = document.querySelector('div[style*="border: 2px dashed"]');
      expect(selectionBox).not.toBeNull();
    });

    it("should update selection box on mousemove", async () => {
      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="cursor: crosshair"]');

      // Start selection
      overlay.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );

      // Move mouse
      document.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 200,
          clientY: 200,
          bubbles: true,
        })
      );

      const selectionBox = document.querySelector('div[style*="border: 2px dashed"]');
      expect(selectionBox.style.display).toBe("block");
    });
  });

  describe("Selection Completion", () => {
    it("should send message with rect on valid selection", async () => {
      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="cursor: crosshair"]');

      // Start selection
      overlay.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );

      // End selection with valid size (> 10px)
      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: 200,
          clientY: 200,
          bubbles: true,
        })
      );

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "regionSelected",
          rect: expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
            width: expect.any(Number),
            height: expect.any(Number),
          }),
        })
      );
    });

    it("should not send regionSelected message for too small selection", async () => {
      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="cursor: crosshair"]');

      // Start selection
      overlay.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );

      // End with tiny selection (< 10px)
      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: 105,
          clientY: 105,
          bubbles: true,
        })
      );

      // Should NOT send regionSelected (but may send regionCancelled)
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: "regionSelected",
        })
      );
    });

    it("should notify user when selection is too small", async () => {
      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="cursor: crosshair"]');

      // Start selection
      overlay.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );

      // End with tiny selection (< 10px)
      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: 105,
          clientY: 105,
          bubbles: true,
        })
      );

      // Wait for async sendMessage to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should send a message to notify user about the cancelled selection
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "regionCancelled",
          reason: "tooSmall",
        })
      );
    });

    it("should clean up overlay after selection", async () => {
      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="cursor: crosshair"]');

      // Complete a selection
      overlay.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );

      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: 200,
          clientY: 200,
          bubbles: true,
        })
      );

      // Overlay should be removed
      const overlayAfter = document.querySelector('div[style*="cursor: crosshair"]');
      expect(overlayAfter).toBeNull();
    });
  });

  describe("Keyboard Handling", () => {
    it("should cancel selection on Escape key", async () => {
      await import("../src/content.js");

      // Press Escape
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        })
      );

      // Overlay should be removed
      const overlay = document.querySelector('div[style*="cursor: crosshair"]');
      expect(overlay).toBeNull();
    });

    it("should reset __ocrRegionSelectorActive flag on cancel", async () => {
      await import("../src/content.js");

      expect(window.__ocrRegionSelectorActive).toBe(true);

      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        })
      );

      expect(window.__ocrRegionSelectorActive).toBe(false);
    });

    it("should send regionCancelled message on Escape key", async () => {
      await import("../src/content.js");

      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "regionCancelled",
          reason: "escape",
        })
      );
    });
  });

  describe("Viewport Clamping", () => {
    it("should reject selection that becomes too small after viewport clamping", async () => {
      // Mock viewport dimensions
      Object.defineProperty(window, "innerWidth", { value: 100, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 100, writable: true });

      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="cursor: crosshair"]');

      // Start selection at edge of viewport
      overlay.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 95,
          clientY: 95,
          bubbles: true,
        })
      );

      // End selection beyond viewport - after clamping width/height will be 5x5 (< 10)
      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: 120,
          clientY: 120,
          bubbles: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should send regionCancelled, not regionSelected
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "regionCancelled",
          reason: "tooSmall",
        })
      );
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: "regionSelected",
        })
      );
    });
  });

  describe("Message Send Failure Handling", () => {
    it("should show alert when regionSelected message fails to send", async () => {
      // Clean up from previous tests - use DOM methods instead of innerHTML
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
      delete window.__ocrRegionSelectorActive;
      vi.resetModules();

      // Reset viewport dimensions (previous test may have changed them)
      Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 768, writable: true });

      // Mock sendMessage to reject BEFORE module import
      chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error("Extension context invalidated"));

      // Mock window.alert
      const alertMock = vi.fn();
      window.alert = alertMock;

      // Import after mocks are set up
      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="cursor: crosshair"]');
      expect(overlay).not.toBeNull();

      // Complete a valid selection
      overlay.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );

      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: 200,
          clientY: 200,
          bubbles: true,
        })
      );

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should show alert to user when message fails
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining("PrivateOCR")
      );
    });
  });

  describe("Cancellation Message Failure Handling", () => {
    it("should log warning when tooSmall cancellation message fails", async () => {
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
      delete window.__ocrRegionSelectorActive;
      vi.resetModules();

      Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 768, writable: true });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error("Extension context invalidated"));

      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="cursor: crosshair"]');

      // Start selection
      overlay.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );

      // End with tiny selection (< 10px)
      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: 105,
          clientY: 105,
          bubbles: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("cancellation"),
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });

    it("should log warning when escape cancellation message fails", async () => {
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
      delete window.__ocrRegionSelectorActive;
      vi.resetModules();

      Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 768, writable: true });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error("Extension context invalidated"));

      await import("../src/content.js");

      // Press Escape
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("cancellation"),
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("Device Pixel Ratio Handling", () => {
    it("should account for devicePixelRatio in rect coordinates", async () => {
      // Mock devicePixelRatio and viewport dimensions
      Object.defineProperty(window, "devicePixelRatio", {
        value: 2,
        writable: true,
      });
      Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 768, writable: true });

      await import("../src/content.js");

      const overlay = document.querySelector('div[style*="cursor: crosshair"]');

      overlay.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );

      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: 200,
          clientY: 200,
          bubbles: true,
        })
      );

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          rect: expect.objectContaining({
            // With DPR of 2, coordinates should be doubled
            width: 200, // 100 * 2
            height: 200, // 100 * 2
          }),
        })
      );
    });
  });
});
