import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const VENDOR_DIR = path.join(PROJECT_ROOT, "vendor", "tesseract");
const MANIFEST_PATH = path.join(PROJECT_ROOT, "manifest.json");
const STYLES_PATH = path.join(PROJECT_ROOT, "src", "styles.css");
const POPUP_HTML_PATH = path.join(PROJECT_ROOT, "src", "popup.html");

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

  describe("CSS and HTML Consistency", () => {
    it("should have CSS selectors that match HTML element IDs", () => {
      const cssContent = fs.readFileSync(STYLES_PATH, "utf-8");
      const htmlContent = fs.readFileSync(POPUP_HTML_PATH, "utf-8");

      // Extract ID selectors from CSS - only match at start of selector or after space/comma
      // This avoids matching hex colors like #6750a4
      const cssIdSelectorMatches = cssContent.match(/(?:^|[\s,{])#([a-zA-Z][\w-]*)/gm) || [];
      const cssIdSelectors = cssIdSelectorMatches.map((m) => {
        const match = m.match(/#([a-zA-Z][\w-]*)/);
        return match ? match[1] : null;
      }).filter(Boolean);

      // Filter out hex color values (3, 4, 6, or 8 hex chars that are all hex digits)
      const hexColorPattern = /^[a-fA-F0-9]{3,8}$/;
      const actualIdSelectors = cssIdSelectors.filter((id) => !hexColorPattern.test(id));

      // Extract IDs from HTML (e.g., id="previewImage")
      const htmlIds = htmlContent.match(/id="([^"]+)"/g)?.map((m) => m.match(/id="([^"]+)"/)[1]) || [];

      // Check that CSS ID selectors have corresponding HTML IDs
      const unmatchedSelectors = actualIdSelectors.filter((selectorId) => {
        return !htmlIds.includes(selectorId);
      });

      expect(unmatchedSelectors, "CSS has ID selectors with no matching HTML elements").toEqual([]);
    });

    it("should have position:relative on containers with absolutely positioned children", () => {
      const cssContent = fs.readFileSync(STYLES_PATH, "utf-8");

      // Check that .preview-container has position: relative
      // since .preview-toolbar uses position: absolute
      const previewContainerMatch = cssContent.match(/\.preview-container\s*\{[^}]+\}/);
      expect(previewContainerMatch).not.toBeNull();

      const hasPositionRelative = previewContainerMatch[0].includes("position") &&
        previewContainerMatch[0].includes("relative");
      expect(hasPositionRelative, ".preview-container should have position: relative for absolute children").toBe(true);
    });
  });
});
