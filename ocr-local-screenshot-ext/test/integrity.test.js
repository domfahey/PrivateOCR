import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const VENDOR_DIR = path.join(PROJECT_ROOT, "vendor", "tesseract");
const ICONS_DIR = path.join(PROJECT_ROOT, "icons");
const MANIFEST_PATH = path.join(PROJECT_ROOT, "manifest.json");
const STYLES_PATH = path.join(PROJECT_ROOT, "src", "styles.css");
const POPUP_HTML_PATH = path.join(PROJECT_ROOT, "src", "popup.html");

describe("Project Integrity", () => {
  describe("Tesseract Vendor Files", () => {
    // Core files required for Tesseract.js v7 to function
    const requiredFiles = [
      "tesseract.min.js",
      "worker.min.js",
      "tesseract-core.wasm",
      "tesseract-core.wasm.js",
      "tesseract-core-lstm.wasm",
      "tesseract-core-lstm.wasm.js",
      "tesseract-core-simd.wasm",
      "tesseract-core-simd.wasm.js",
      "tesseract-core-simd-lstm.wasm",
      "tesseract-core-simd-lstm.wasm.js",
      "tesseract-core-relaxedsimd.wasm",
      "tesseract-core-relaxedsimd.wasm.js",
      "tesseract-core-relaxedsimd-lstm.wasm",
      "tesseract-core-relaxedsimd-lstm.wasm.js",
    ];

    it.each(requiredFiles)("should have %s present", (filename) => {
      const filePath = path.join(VENDOR_DIR, filename);
      const exists = fs.existsSync(filePath);
      expect(exists, `Missing required vendor file: ${filename}`).toBe(true);
    });
  });

  describe("Icon Files", () => {
    const requiredIcons = ["icon16.png", "icon48.png", "icon128.png"];

    it.each(requiredIcons)("should have %s present", (filename) => {
      const filePath = path.join(ICONS_DIR, filename);
      const exists = fs.existsSync(filePath);
      expect(exists, `Missing required icon: ${filename}`).toBe(true);
    });

    it("should have icons defined in manifest.json", () => {
      const manifestContent = fs.readFileSync(MANIFEST_PATH, "utf-8");
      const manifest = JSON.parse(manifestContent);

      expect(manifest.icons).toBeDefined();
      expect(manifest.icons["16"]).toBe("icons/icon16.png");
      expect(manifest.icons["48"]).toBe("icons/icon48.png");
      expect(manifest.icons["128"]).toBe("icons/icon128.png");
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

      // Extract ID selectors from CSS - match # at start of line or after selector chars
      // but NOT after : (which would indicate a property value like color: #fff)
      // Pattern: look for # that follows {, whitespace, comma, or start of line (not :)
      const lines = cssContent.split('\n');
      const cssIdSelectors = [];

      for (const line of lines) {
        // Skip lines that are CSS property values (contain : before #)
        // Match lines like "#previewImage {" or selectors like ".foo, #bar"
        const selectorMatch = line.match(/^([^:]*?)#([a-zA-Z][\w-]*)/);
        if (selectorMatch && !selectorMatch[1].includes(':')) {
          cssIdSelectors.push(selectorMatch[2]);
        }
      }

      // Extract IDs from HTML (e.g., id="previewImage")
      const htmlIds = htmlContent.match(/id="([^"]+)"/g)?.map((m) => m.match(/id="([^"]+)"/)[1]) || [];

      // Check that CSS ID selectors have corresponding HTML IDs
      const unmatchedSelectors = cssIdSelectors.filter((selectorId) => {
        return !htmlIds.includes(selectorId);
      });

      expect(unmatchedSelectors, "CSS has ID selectors with no matching HTML elements").toEqual([]);
    });

    it("should have position:relative on containers with absolutely positioned children", () => {
      const cssContent = fs.readFileSync(STYLES_PATH, "utf-8");

      // Check that .preview-container has position: relative
      // since .preview-toolbar uses position: absolute
      // Use a more robust regex that handles multi-line blocks
      const previewContainerMatch = cssContent.match(/\.preview-container\s*\{[\s\S]*?position:\s*relative[\s\S]*?\}/);

      expect(
        previewContainerMatch,
        ".preview-container should have position: relative for absolute children"
      ).not.toBeNull();
    });
  });
});
