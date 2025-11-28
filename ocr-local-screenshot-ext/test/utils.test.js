/**
 * Unit tests for utility functions
 */

import { describe, it, expect, vi } from "vitest";
import {
  dataUrlToBlob,
  scaleImageIfNeeded,
  copyToClipboard,
  countWords,
  isValidDataUrl,
  blobToFile,
  MAX_PIXELS,
  MAX_DIMENSION,
} from "../src/utils.js";

describe("dataUrlToBlob", () => {
  it("should convert a valid PNG data URL to a Blob", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    const blob = dataUrlToBlob(dataUrl);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
  });

  it("should convert a valid JPEG data URL to a Blob", () => {
    const dataUrl = "data:image/jpeg;base64,/9j/4AAQ";
    const blob = dataUrlToBlob(dataUrl);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/jpeg");
  });

  it("should handle data URL with different MIME types", () => {
    const dataUrl = "data:text/plain;base64,SGVsbG8=";
    const blob = dataUrlToBlob(dataUrl);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("text/plain");
  });

  it("should handle missing MIME type gracefully", () => {
    const dataUrl = "data:;base64,SGVsbG8=";
    const blob = dataUrlToBlob(dataUrl);

    expect(blob).toBeInstanceOf(Blob);
    // jsdom may not fully support type, just check it's a blob
    expect(blob.size).toBeGreaterThan(0);
  });

  it("should correctly decode base64 content", () => {
    // "Hello" in base64
    const dataUrl = "data:text/plain;base64,SGVsbG8=";
    const blob = dataUrlToBlob(dataUrl);

    // Check blob size matches decoded content ("Hello" = 5 bytes)
    expect(blob.size).toBe(5);
  });
});

describe("isValidDataUrl", () => {
  it("should return true for valid PNG data URL", () => {
    expect(isValidDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
  });

  it("should return true for valid JPEG data URL", () => {
    expect(isValidDataUrl("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
  });

  it("should return false for null", () => {
    expect(isValidDataUrl(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isValidDataUrl(undefined)).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isValidDataUrl("")).toBe(false);
  });

  it("should return false for regular URL", () => {
    expect(isValidDataUrl("https://example.com/image.png")).toBe(false);
  });

  it("should return false for malformed data URL", () => {
    expect(isValidDataUrl("data:image/png,notbase64")).toBe(false);
  });
});

describe("countWords", () => {
  it("should count words in a simple sentence", () => {
    expect(countWords("Hello world")).toBe(2);
  });

  it("should count words with multiple spaces", () => {
    expect(countWords("Hello   world")).toBe(2);
  });

  it("should count words with newlines", () => {
    expect(countWords("Hello\nworld\ntest")).toBe(3);
  });

  it("should count words with tabs", () => {
    expect(countWords("Hello\tworld")).toBe(2);
  });

  it("should return 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("should return 0 for whitespace only", () => {
    expect(countWords("   \n\t  ")).toBe(0);
  });

  it("should return 0 for null", () => {
    expect(countWords(null)).toBe(0);
  });

  it("should return 0 for undefined", () => {
    expect(countWords(undefined)).toBe(0);
  });

  it("should handle single word", () => {
    expect(countWords("Hello")).toBe(1);
  });

  it("should handle long text", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    expect(countWords(text)).toBe(9);
  });
});

describe("copyToClipboard", () => {
  it("should return true when clipboard write succeeds", async () => {
    const result = await copyToClipboard("test text");

    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test text");
  });

  it("should return false for empty string", async () => {
    const result = await copyToClipboard("");

    expect(result).toBe(false);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("should return false for null", async () => {
    const result = await copyToClipboard(null);

    expect(result).toBe(false);
  });

  it("should return false when clipboard write fails", async () => {
    navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));

    const result = await copyToClipboard("test text");

    expect(result).toBe(false);
  });
});

describe("blobToFile", () => {
  it("should create a File from a Blob", () => {
    const blob = new Blob(["test content"], { type: "text/plain" });
    const file = blobToFile(blob, "test.txt");

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("test.txt");
    expect(file.type).toBe("text/plain");
  });

  it("should use default filename if not provided", () => {
    const blob = new Blob(["test"], { type: "image/png" });
    const file = blobToFile(blob);

    expect(file.name).toBe("image.png");
  });

  it("should preserve blob content size", () => {
    const content = "Hello World";
    const blob = new Blob([content], { type: "text/plain" });
    const file = blobToFile(blob, "test.txt");

    expect(file.size).toBe(content.length);
  });
});

describe("scaleImageIfNeeded", () => {
  let originalImage;
  let originalCreateElement;

  beforeEach(() => {
    // Mock Image
    originalImage = global.Image;
    global.Image = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.src = "";
        this.width = 0;
        this.height = 0;
        setTimeout(() => {
           // parsing logic to simulate width/height from mock src if needed
           // or just let test set dimensions
           if (this.onload) this.onload();
        }, 10);
      }
    };

    // Mock Canvas
    originalCreateElement = document.createElement;
    document.createElement = vi.fn((tag) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: vi.fn(),
          }),
          toDataURL: () => "data:image/png;base64,mockScaled",
        };
      }
      return originalCreateElement.call(document, tag);
    });
  });

  afterEach(() => {
    global.Image = originalImage;
    document.createElement = originalCreateElement;
  });

  it("should return original url if image is small enough", async () => {
    const dataUrl = "data:image/png;base64,small";
    
    // Hook into Image constructor to set dimensions
    const OriginalMock = global.Image;
    global.Image = class extends OriginalMock {
        constructor() {
            super();
            this.width = 100;
            this.height = 100;
        }
    };

    const result = await scaleImageIfNeeded(dataUrl);
    expect(result.scaled).toBe(false);
    expect(result.dataUrl).toBe(dataUrl);
  });

  it("should scale if pixels exceed limit", async () => {
    const dataUrl = "data:image/png;base64,large";
    
    // Hook for large image
    const OriginalMock = global.Image;
    global.Image = class extends OriginalMock {
        constructor() {
            super();
            // 3000x2000 = 6M pixels > 5M limit
            this.width = 3000;
            this.height = 2000;
        }
    };

    const result = await scaleImageIfNeeded(dataUrl);
    expect(result.scaled).toBe(true);
    expect(result.dataUrl).toBe("data:image/png;base64,mockScaled");
  });

  it("should scale if width exceeds limit", async () => {
      const dataUrl = "data:image/png;base64,wide";
      
      const OriginalMock = global.Image;
      global.Image = class extends OriginalMock {
          constructor() {
              super();
              this.width = 4000; // > 3000 limit
              this.height = 100;
          }
      };
  
      const result = await scaleImageIfNeeded(dataUrl);
      expect(result.scaled).toBe(true);
  });

  it("should scale if height exceeds limit", async () => {
      const dataUrl = "data:image/png;base64,tall";
      
      const OriginalMock = global.Image;
      global.Image = class extends OriginalMock {
          constructor() {
              super();
              this.width = 100; 
              this.height = 4000; // > 3000 limit
          }
      };
  
      const result = await scaleImageIfNeeded(dataUrl);
      expect(result.scaled).toBe(true);
  });

  it("should handle image load error", async () => {
    const dataUrl = "data:image/png;base64,bad";
    
    global.Image = class {
        constructor() {
            setTimeout(() => {
                if (this.onerror) this.onerror();
            }, 10);
        }
    };

    const result = await scaleImageIfNeeded(dataUrl);
    expect(result.scaled).toBe(false);
    expect(result.dataUrl).toBe(dataUrl);
  });

  it("should export MAX_PIXELS constant", () => {
    expect(MAX_PIXELS).toBe(5000000);
  });

  it("should export MAX_DIMENSION constant", () => {
    expect(MAX_DIMENSION).toBe(3000);
  });
});

describe("constants", () => {
  it("MAX_PIXELS should be 5 megapixels", () => {
    expect(MAX_PIXELS).toBe(5000000);
  });

  it("MAX_DIMENSION should be 3000", () => {
    expect(MAX_DIMENSION).toBe(3000);
  });
});
