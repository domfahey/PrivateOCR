# Contributing to PrivateOCR

Thank you for your interest in contributing to the PrivateOCR extension! This document provides guidelines and information for developers.

## Development Setup

1.  **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) and `npm` installed.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```

## Project Structure

```text
ocr-local-screenshot-ext/
├── src/                 # Source code
│   ├── popup.html       # Extension popup HTML
│   ├── popup.js         # Popup entry point (ES Module)
│   ├── popup-logic.js   # Core popup logic (Testable)
│   ├── background.js    # Background service worker
│   ├── content.js       # Content script for region selection
│   ├── styles.css       # Styles
│   └── utils.js         # Utility functions
├── vendor/              # Third-party dependencies
│   ├── tesseract/       # Tesseract.js worker and core
│   └── tessdata/        # Trained language data
├── test/                # Unit tests (Vitest)
└── manifest.json        # Extension manifest
```

## Architecture

This is a Chrome Manifest V3 extension.

- **Privacy-First**: No network requests are made. Tesseract.js is bundled locally.

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Chrome Extension                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   popup.js   │───▶│popup-logic.js│───▶│  Tesseract Worker    │  │
│  │  (entry)     │    │ (business    │    │  (vendor/tesseract/) │  │
│  │              │    │   logic)     │    │                      │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────────┘  │
│                             │                                        │
│                             │ injects                                │
│                             ▼                                        │
│  ┌──────────────┐    ┌──────────────┐                               │
│  │background.js │◀───│  content.js  │  (region selection overlay)   │
│  │ (service     │    │  (injected   │                               │
│  │  worker)     │    │   into tab)  │                               │
│  └──────┬───────┘    └──────────────┘                               │
│         │                                                            │
│         │ stores data                                                │
│         ▼                                                            │
│  ┌──────────────┐                                                   │
│  │chrome.storage│                                                   │
│  │   .local     │                                                   │
│  └──────────────┘                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Full-Page OCR

```
User clicks "Capture Tab"
         │
         ▼
┌─────────────────┐   captureVisibleTab   ┌─────────────────┐
│  popup-logic.js │ ────────────────────▶ │  Chrome API     │
└────────┬────────┘                       └────────┬────────┘
         │                                         │
         │◀────────────── dataUrl ─────────────────┘
         │
         ▼
┌─────────────────┐   (if > 5MP)   ┌─────────────────┐
│ scaleImageIfNeeded │ ──────────▶ │  Scaled Image   │
└────────┬────────┘                └────────┬────────┘
         │                                  │
         ▼◀─────────────────────────────────┘
┌─────────────────┐
│ Tesseract.js    │───▶ recognized text ───▶ clipboard
│ worker.recognize│
└─────────────────┘
```

### Data Flow: Region Selection

```
User clicks "Select Region"
         │
         ▼
┌─────────────────┐   executeScript   ┌─────────────────┐
│  popup-logic.js │ ────────────────▶ │   content.js    │
└─────────────────┘                   │ (overlay shows) │
                                      └────────┬────────┘
                                               │
                                   User drags rectangle
                                               │
                                               ▼
┌─────────────────┐   sendMessage    ┌─────────────────┐
│  background.js  │ ◀───────────────│   content.js    │
│                 │  {rect, type}    └─────────────────┘
└────────┬────────┘
         │
         ▼ captureVisibleTab + store in chrome.storage.local
         │
         ▼ opens popup.html?regionMode=true
         │
┌────────┴────────┐
│  popup-logic.js │───▶ reads storage ───▶ crops image ───▶ OCR
└─────────────────┘
```

### Full-page OCR:

1.  `popup-logic.js` triggers `chrome.tabs.captureVisibleTab`.
2.  Image is scaled if necessary (`utils.js`).
3.  Tesseract worker processes the image blob.

### Region Selection:

1.  `popup-logic.js` injects `content.js`.
2.  User selects a region; coordinates are sent to `background.js`.
3.  `background.js` captures the tab and stores the screenshot & coordinates in `chrome.storage.local`.
4.  `background.js` opens the popup again with `?regionMode=true`.
5.  `popup-logic.js` detects the mode, crops the image using the stored coordinates, and runs OCR.

## Testing

We use [Vitest](https://vitest.dev/) for unit testing.

### Running Tests

- **Run all tests**:
  ```bash
  npm test
  ```
- **Run with coverage**:
  ```bash
  npm run test:coverage
  ```
- **Watch mode**:
  ```bash
  npm run test:watch
  ```
- **Run a single file**:
  ```bash
  npx vitest run test/utils.test.js
  ```
- **Run tests matching a pattern**:
  ```bash
  npx vitest run -t "dataUrlToBlob"
  ```

### Test Structure

Tests are in the `test/` directory with the naming convention `*.test.js`:

```text
test/
├── setup.js           # Global mocks (Chrome APIs, Tesseract, clipboard)
├── utils.test.js      # Tests for src/utils.js
├── popup.test.js      # Tests for popup-logic.js
├── content.test.js    # Tests for content.js
├── background.test.js # Tests for background.js
├── settings.test.js   # Tests for settings page
└── integrity.test.js  # Extension integrity checks
```

### Writing New Tests

1. **Create a test file** in `test/` matching the source file name:

   ```javascript
   // test/myfeature.test.js
   import { describe, it, expect, vi } from "vitest";
   import { myFunction } from "../src/myfeature.js";

   describe("myFunction", () => {
     it("should do something", () => {
       expect(myFunction()).toBe(expected);
     });
   });
   ```

2. **Mocking Chrome APIs**: The global `chrome` mock is set up in `test/setup.js`. For custom scenarios:

   ```javascript
   import { createChromeMock } from "./setup.js";

   it("handles custom tab data", async () => {
     chrome.tabs.query.mockResolvedValue([{ id: 5, url: "https://example.com" }]);
     // ...test code
   });
   ```

3. **Mocking DOM APIs**: Canvas and Image are mocked in setup. Override as needed:

   ```javascript
   beforeEach(() => {
     global.Image = class {
       constructor() {
         this.width = 100;
         this.height = 100;
         setTimeout(() => this.onload?.(), 10);
       }
     };
   });
   ```

4. **Testing async code**: Use `async/await`:
   ```javascript
   it("should handle async operations", async () => {
     const result = await asyncFunction();
     expect(result).toBe(expected);
   });
   ```

### Mocking Guidelines

- **Chrome APIs**: Already mocked globally. Override specific methods as needed.
- **Tesseract.js**: Mocked to return `{ data: { text: "Mock recognized text" } }`.
- **Clipboard**: Mocked via `navigator.clipboard.writeText`.
- **Canvas**: `toDataURL` and `toBlob` are mocked for image processing tests.

### Test Coverage

Aim for meaningful coverage of:

- Happy path functionality
- Edge cases (empty input, invalid data)
- Error handling (rejected promises, exceptions)

The tests heavily mock Chrome APIs (`chrome.tabs`, `chrome.storage`, etc.) and DOM APIs (`Image`, `Canvas`) to run in a Node.js/JSDOM environment.

## Code Style

We use **ESLint** and **Prettier** to maintain code quality.

- **Linting**:
  ```bash
  npm run lint
  ```
- **Fix Lint Errors**:
  ```bash
  npm run lint:fix
  ```
- **Format Code**:
  ```bash
  npm run format
  ```

Please ensure all tests pass and linting checks succeed before submitting a pull request.
