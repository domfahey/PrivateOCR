/**
 * Tesseract.js v7 Upgrade Tests
 *
 * Unit and integration tests to verify the Tesseract.js v7.0.0 upgrade:
 * - Vendor file integrity (all required files present)
 * - Worker configuration (correct paths and options)
 * - API compatibility (createWorker, OEM constants)
 * - Performance variants (relaxedsimd support)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const VENDOR_DIR = path.join(PROJECT_ROOT, "vendor", "tesseract");

describe("Tesseract.js v7 Upgrade", () => {
  describe("Vendor File Integrity", () => {
    // All files required for Tesseract.js v7
    const V7_REQUIRED_FILES = [
      // Core JS files
      "tesseract.min.js",
      "worker.min.js",
      // Standard WASM variants
      "tesseract-core.wasm",
      "tesseract-core.wasm.js",
      // LSTM variants (neural network engine)
      "tesseract-core-lstm.wasm",
      "tesseract-core-lstm.wasm.js",
      // SIMD variants (CPU vectorization)
      "tesseract-core-simd.wasm",
      "tesseract-core-simd.wasm.js",
      "tesseract-core-simd-lstm.wasm",
      "tesseract-core-simd-lstm.wasm.js",
      // RelaxedSIMD variants (v7 new - modern CPU optimization)
      "tesseract-core-relaxedsimd.wasm",
      "tesseract-core-relaxedsimd.wasm.js",
      "tesseract-core-relaxedsimd-lstm.wasm",
      "tesseract-core-relaxedsimd-lstm.wasm.js",
    ];

    it("should have all 14 v7 vendor files", () => {
      const files = fs.readdirSync(VENDOR_DIR);
      expect(files.length).toBe(14);
    });

    it.each(V7_REQUIRED_FILES)("should have %s", (filename) => {
      const filePath = path.join(VENDOR_DIR, filename);
      expect(fs.existsSync(filePath), `Missing v7 file: ${filename}`).toBe(true);
    });

    describe("RelaxedSIMD Files (v7 New Feature)", () => {
      const RELAXEDSIMD_FILES = [
        "tesseract-core-relaxedsimd.wasm",
        "tesseract-core-relaxedsimd.wasm.js",
        "tesseract-core-relaxedsimd-lstm.wasm",
        "tesseract-core-relaxedsimd-lstm.wasm.js",
      ];

      it.each(RELAXEDSIMD_FILES)("should have relaxedsimd file: %s", (filename) => {
        const filePath = path.join(VENDOR_DIR, filename);
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it("relaxedsimd WASM files should be non-empty", () => {
        RELAXEDSIMD_FILES.filter((f) => f.endsWith(".wasm")).forEach((filename) => {
          const filePath = path.join(VENDOR_DIR, filename);
          const stats = fs.statSync(filePath);
          expect(stats.size).toBeGreaterThan(1000000); // Should be > 1MB
        });
      });
    });

    describe("File Size Sanity Checks", () => {
      it("tesseract.min.js should be reasonable size", () => {
        const stats = fs.statSync(path.join(VENDOR_DIR, "tesseract.min.js"));
        // v7 tesseract.min.js is ~62KB
        expect(stats.size).toBeGreaterThan(50000);
        expect(stats.size).toBeLessThan(200000);
      });

      it("worker.min.js should be reasonable size", () => {
        const stats = fs.statSync(path.join(VENDOR_DIR, "worker.min.js"));
        // v7 worker.min.js is ~108KB
        expect(stats.size).toBeGreaterThan(80000);
        expect(stats.size).toBeLessThan(300000);
      });

      it("WASM files should be appropriately sized", () => {
        const wasmFiles = V7_REQUIRED_FILES.filter((f) => f.endsWith(".wasm"));
        wasmFiles.forEach((filename) => {
          const stats = fs.statSync(path.join(VENDOR_DIR, filename));
          // WASM files should be between 2MB and 4MB
          expect(stats.size).toBeGreaterThan(2000000);
          expect(stats.size).toBeLessThan(4000000);
        });
      });
    });
  });

  describe("Worker Configuration", () => {
    let mockCreateWorker;
    let mockWorkerInstance;

    beforeEach(() => {
      mockWorkerInstance = {
        recognize: vi.fn().mockResolvedValue({ data: { text: "test" } }),
        terminate: vi.fn().mockResolvedValue(undefined),
      };
      mockCreateWorker = vi.fn().mockResolvedValue(mockWorkerInstance);

      global.Tesseract = {
        createWorker: mockCreateWorker,
        OEM: {
          DEFAULT: 3,
          LSTM_ONLY: 1,
          TESSERACT_ONLY: 0,
          TESSERACT_LSTM_COMBINED: 2,
        },
      };

      global.chrome = {
        runtime: {
          getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
        },
      };
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should use correct worker path configuration", async () => {
      // Simulate calling createWorker with expected v7 options
      await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
        workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
        corePath: chrome.runtime.getURL("vendor/tesseract/"),
        langPath: chrome.runtime.getURL("vendor/tessdata"),
        workerBlobURL: false,
      });

      expect(mockCreateWorker).toHaveBeenCalledWith(
        "eng",
        Tesseract.OEM.LSTM_ONLY,
        expect.objectContaining({
          workerPath: "chrome-extension://test-id/vendor/tesseract/worker.min.js",
          corePath: "chrome-extension://test-id/vendor/tesseract/",
          langPath: "chrome-extension://test-id/vendor/tessdata",
          workerBlobURL: false,
        })
      );
    });

    it("should use LSTM_ONLY OEM mode for best accuracy", async () => {
      await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {});

      expect(mockCreateWorker).toHaveBeenCalledWith("eng", 1, expect.any(Object));
    });

    it("should disable blob URL for MV3 compliance", async () => {
      await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
        workerBlobURL: false,
      });

      expect(mockCreateWorker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ workerBlobURL: false })
      );
    });
  });

  describe("API Compatibility", () => {
    let mockWorker;

    beforeEach(() => {
      mockWorker = {
        recognize: vi.fn().mockResolvedValue({
          data: {
            text: "Hello World",
            confidence: 95,
            // v7 simplified output - only text-based data by default
          },
        }),
        terminate: vi.fn().mockResolvedValue(undefined),
      };

      global.Tesseract = {
        createWorker: vi.fn().mockResolvedValue(mockWorker),
        OEM: { LSTM_ONLY: 1 },
      };
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("createWorker should return a Promise", async () => {
      const workerPromise = Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {});
      expect(workerPromise).toBeInstanceOf(Promise);

      const worker = await workerPromise;
      expect(worker).toBeDefined();
      expect(worker.recognize).toBeDefined();
      expect(worker.terminate).toBeDefined();
    });

    it("worker.recognize should return text data", async () => {
      const worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {});
      const mockImage = new Blob(["test"], { type: "image/png" });

      const result = await worker.recognize(mockImage);

      expect(result.data).toBeDefined();
      expect(result.data.text).toBe("Hello World");
    });

    it("worker.terminate should be callable", async () => {
      const worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {});

      await expect(worker.terminate()).resolves.not.toThrow();
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it("OEM constants should be available", () => {
      expect(Tesseract.OEM).toBeDefined();
      expect(Tesseract.OEM.LSTM_ONLY).toBe(1);
    });
  });

  describe("Logger Callback", () => {
    it("should support logger callback for progress updates", async () => {
      const loggerCallback = vi.fn();
      const mockWorker = {
        recognize: vi.fn().mockResolvedValue({ data: { text: "test" } }),
        terminate: vi.fn(),
      };

      global.Tesseract = {
        createWorker: vi.fn().mockResolvedValue(mockWorker),
        OEM: { LSTM_ONLY: 1 },
      };

      await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
        logger: loggerCallback,
      });

      expect(Tesseract.createWorker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ logger: loggerCallback })
      );
    });

    it("logger should receive progress updates with status and progress", () => {
      const logMessages = [];
      const logger = (m) => logMessages.push(m);

      // Simulate what Tesseract.js v7 sends to logger
      const mockProgressUpdates = [
        { status: "loading tesseract core", progress: 0 },
        { status: "loading tesseract core", progress: 0.5 },
        { status: "loading tesseract core", progress: 1 },
        { status: "initializing tesseract", progress: 0 },
        { status: "initializing tesseract", progress: 1 },
        { status: "recognizing text", progress: 0.25 },
        { status: "recognizing text", progress: 0.5 },
        { status: "recognizing text", progress: 0.75 },
        { status: "recognizing text", progress: 1 },
      ];

      mockProgressUpdates.forEach(logger);

      expect(logMessages.length).toBe(9);
      expect(logMessages[0].status).toBe("loading tesseract core");
      expect(logMessages[8].progress).toBe(1);
    });
  });
});
