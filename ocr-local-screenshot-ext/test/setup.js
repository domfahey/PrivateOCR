/**
 * Test setup - Chrome API mocks and global test utilities
 */

import { vi } from "vitest";

// Mock Chrome extension APIs
const createChromeMock = () => ({
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, windowId: 1 }]),
    captureVisibleTab: vi.fn().mockResolvedValue("data:image/png;base64,iVBORw0KGgo="),
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue([]),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
  windows: {
    create: vi.fn().mockResolvedValue({ id: 1 }),
  },
});

// Mock Tesseract.js
const createTesseractMock = () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: vi.fn().mockResolvedValue({
      data: { text: "Mock recognized text" },
    }),
    terminate: vi.fn().mockResolvedValue(undefined),
  }),
});

// Set up global mocks before each test
beforeEach(() => {
  // Reset and create fresh mocks
  globalThis.chrome = createChromeMock();
  globalThis.Tesseract = createTesseractMock();

  // Mock window.close to prevent DOM destruction in tests
  window.close = vi.fn();

  // Mock clipboard API
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
    },
    writable: true,
    configurable: true,
  });

  // Mock canvas context for jsdom
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  }));

  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,mock");
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
    callback(new Blob(["mock"], { type: "image/png" }));
  });
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Export mock creators for custom test scenarios
export { createChromeMock, createTesseractMock };
