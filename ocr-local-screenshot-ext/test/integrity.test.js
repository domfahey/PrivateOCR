import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const VENDOR_DIR = path.join(PROJECT_ROOT, "vendor", "tesseract");
const MANIFEST_PATH = path.join(PROJECT_ROOT, "manifest.json");

describe("Project Integrity", () => {
  describe("Tesseract Vendor Files", () => {
    const requiredFiles = [
      "tesseract.min.js",
      "worker.min.js",
      "tesseract-core.wasm.js",
      "tesseract-core.wasm",
      "tesseract-core-simd.wasm.js",
      "tesseract-core-simd.wasm",
      // Tesseract.js v6+ often requires LSTM variants by default
      "tesseract-core-lstm.wasm.js",
      "tesseract-core-lstm.wasm",
      "tesseract-core-simd-lstm.wasm.js",
      "tesseract-core-simd-lstm.wasm",
    ];

    it.each(requiredFiles)("should have %s present", (filename) => {
      const filePath = path.join(VENDOR_DIR, filename);
      const exists = fs.existsSync(filePath);
      expect(exists, `Missing required vendor file: ${filename}`).toBe(true);
    });
  });

  describe("Manifest Configuration", () => {
    it("should expose vendor files in web_accessible_resources", () => {
      const manifestContent = fs.readFileSync(MANIFEST_PATH, "utf-8");
      const manifest = JSON.parse(manifestContent);

      const webAccessible = manifest.web_accessible_resources || [];
      const resources = webAccessible.flatMap((entry) => entry.resources);

      // Check for wildcard match
      const hasVendorWildcard = resources.some(
        (r) => r === "vendor/tesseract/*" || r === "vendor/tesseract/*.js" || r === "vendor/tesseract/*.wasm"
      );

      expect(hasVendorWildcard).toBe(true);
    });
  });
});
