import { describe, it, expect, vi, beforeEach } from "vitest";
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
