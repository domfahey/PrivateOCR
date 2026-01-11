import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const SETTINGS_HTML_PATH = path.resolve(__dirname, "../src/settings.html");

// Mock Chrome APIs
global.chrome = {
  tabs: {
    create: vi.fn(),
  },
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
  },
};

describe("Settings Page", () => {
  it("should exist", () => {
    const exists = fs.existsSync(SETTINGS_HTML_PATH);
    expect(exists).toBe(true);
  });

  it("should contain required sections", () => {
    const content = fs.readFileSync(SETTINGS_HTML_PATH, "utf-8");
    expect(content).toContain("PrivateOCR Settings");
    expect(content).toContain("General");
    expect(content).toContain("About");
    expect(content).toContain("settings.js");
  });
});

describe("Settings Script", () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should log message on DOMContentLoaded", async () => {
    // Import the settings script (which adds event listener)
    await import("../src/settings.js");

    // Dispatch DOMContentLoaded event
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // Wait for event handler to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleSpy).toHaveBeenCalledWith("Settings page loaded");
  });
});
