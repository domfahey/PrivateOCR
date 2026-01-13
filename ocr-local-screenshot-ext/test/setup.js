/**
 * Test setup - Chrome API mocks and global test utilities
 */

import { vi } from "vitest";

// Mock Chrome extension APIs
const createChromeMock = () => ({
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, windowId: 1 }]),
    captureVisibleTab: vi.fn().mockResolvedValue("data:image/png;base64,iVBORw0KGgo="),
    create: vi.fn().mockResolvedValue({ id: 1 }),
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
  notifications: {
    create: vi.fn().mockResolvedValue("notification-id"),
  },
  alarms: {
    create: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
});

// Mock Tesseract.js (v7 API)
const createTesseractMock = () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: vi.fn().mockResolvedValue({
      data: { text: "Mock recognized text" },
    }),
    terminate: vi.fn().mockResolvedValue(undefined),
  }),
  // v7 OEM constants
  OEM: {
    TESSERACT_ONLY: 0,
    LSTM_ONLY: 1,
    TESSERACT_LSTM_COMBINED: 2,
    DEFAULT: 3,
  },
});

// Polyfill PointerEvent for jsdom (doesn't support it natively)
if (typeof PointerEvent === "undefined") {
  globalThis.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }
  };
}

// Polyfill setPointerCapture/releasePointerCapture for jsdom elements
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function () {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = function () {};
}

// Mock requestAnimationFrame to execute callbacks synchronously for testing
// (jsdom doesn't automatically execute RAF callbacks)
if (typeof window !== "undefined" && !window._rafMocked) {
  window._rafMocked = true;
  const originalRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (callback) {
    // Execute callback synchronously for tests, but still return an id
    callback(performance.now());
    return 0;
  };
  window.cancelAnimationFrame = function () {};
}

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
