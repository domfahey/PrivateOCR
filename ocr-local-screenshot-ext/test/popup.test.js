/**
 * Tests for popup functionality
 * Note: popup.js is a browser script, not an ES module.
 * We test the DOM setup and mock interactions here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Popup DOM", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="status"></div>
      <textarea id="output"></textarea>
      <button id="screenshotBtn">OCR current tab</button>
      <button id="regionBtn">Select region</button>
      <button id="copyBtn">Copy text</button>
      <button id="cancelBtn" style="display:none">Cancel</button>
    `;
  });

  describe("UI Elements", () => {
    it("should have status element", () => {
      expect(document.getElementById("status")).not.toBeNull();
    });

    it("should have output textarea", () => {
      expect(document.getElementById("output")).not.toBeNull();
    });

    it("should have screenshot button", () => {
      expect(document.getElementById("screenshotBtn")).not.toBeNull();
    });

    it("should have region button", () => {
      expect(document.getElementById("regionBtn")).not.toBeNull();
    });

    it("should have copy button", () => {
      expect(document.getElementById("copyBtn")).not.toBeNull();
    });

    it("should have cancel button", () => {
      expect(document.getElementById("cancelBtn")).not.toBeNull();
    });

    it("should have cancel button hidden by default", () => {
      const cancelBtn = document.getElementById("cancelBtn");
      expect(cancelBtn.style.display).toBe("none");
    });
  });

  describe("Chrome API Mocks", () => {
    it("should have chrome.tabs.query mocked", () => {
      expect(chrome.tabs.query).toBeDefined();
      expect(typeof chrome.tabs.query).toBe("function");
    });

    it("should have chrome.tabs.captureVisibleTab mocked", () => {
      expect(chrome.tabs.captureVisibleTab).toBeDefined();
      expect(typeof chrome.tabs.captureVisibleTab).toBe("function");
    });

    it("should have chrome.scripting.executeScript mocked", () => {
      expect(chrome.scripting.executeScript).toBeDefined();
      expect(typeof chrome.scripting.executeScript).toBe("function");
    });

    it("should have chrome.storage.local mocked", () => {
      expect(chrome.storage.local.get).toBeDefined();
      expect(chrome.storage.local.set).toBeDefined();
      expect(chrome.storage.local.remove).toBeDefined();
    });

    it("should have Tesseract mocked", () => {
      expect(Tesseract.createWorker).toBeDefined();
      expect(typeof Tesseract.createWorker).toBe("function");
    });
  });

  describe("Clipboard API", () => {
    it("should have clipboard.writeText mocked", () => {
      expect(navigator.clipboard.writeText).toBeDefined();
    });

    it("should successfully write to clipboard", async () => {
      await navigator.clipboard.writeText("test");
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test");
    });
  });

  describe("Chrome Runtime", () => {
    it("should resolve extension URLs", () => {
      const url = chrome.runtime.getURL("lib/worker.min.js");
      expect(url).toContain("lib/worker.min.js");
    });
  });
});

describe("Tesseract Worker Mock", () => {
  it("should create worker that returns mock text", async () => {
    const worker = await Tesseract.createWorker();
    const result = await worker.recognize("test");

    expect(result.data.text).toBe("Mock recognized text");
  });

  it("should be able to terminate worker", async () => {
    const worker = await Tesseract.createWorker();
    await expect(worker.terminate()).resolves.toBeUndefined();
  });
});
