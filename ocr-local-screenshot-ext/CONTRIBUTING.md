# Contributing to Local OCR Screenshot

Thank you for your interest in contributing to the Local OCR Screenshot extension! This document provides guidelines and information for developers.

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

-   **Privacy-First**: No network requests are made. Tesseract.js is bundled locally.
-   **Full-page OCR**:
    1.  `popup-logic.js` triggers `chrome.tabs.captureVisibleTab`.
    2.  Image is scaled if necessary (`utils.js`).
    3.  Tesseract worker processes the image blob.
-   **Region Selection**:
    1.  `popup-logic.js` injects `content.js`.
    2.  User selects a region; coordinates are sent to `background.js`.
    3.  `background.js` captures the tab and stores the screenshot & coordinates in `chrome.storage.local`.
    4.  `background.js` opens the popup again with `?regionMode=true`.
    5.  `popup-logic.js` detects the mode, crops the image using the stored coordinates, and runs OCR.

## Testing

We use [Vitest](https://vitest.dev/) for unit testing.

-   **Run all tests**:
    ```bash
    npm test
    ```
-   **Run with coverage**:
    ```bash
    npm run test:coverage
    ```
-   **Watch mode**:
    ```bash
    npm run test:watch
    ```

The tests heavily mock Chrome APIs (`chrome.tabs`, `chrome.storage`, etc.) and DOM APIs (`Image`, `Canvas`) to run in a Node.js/JSDOM environment.

## Code Style

We use **ESLint** and **Prettier** to maintain code quality.

-   **Linting**:
    ```bash
    npm run lint
    ```
-   **Fix Lint Errors**:
    ```bash
    npm run lint:fix
    ```
-   **Format Code**:
    ```bash
    npm run format
    ```

Please ensure all tests pass and linting checks succeed before submitting a pull request.
