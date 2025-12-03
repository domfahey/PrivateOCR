# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-11-28

### Changed

- **Renaming:** Project renamed to **PrivateOCR** to better reflect its core value proposition.
- **UI:** Added a side-by-side view option to show the source image alongside the extracted text.
- **Window Size:** Increased the popup window size to 780x580px to accommodate the new split view and improve usability.

### Changed

- Switched to the "Best" English language model (`eng.traineddata` from `tessdata_best`) to optimize for OCR accuracy over speed. This increases the bundle size by ~10MB but significantly improves recognition quality.

### Fixed

- Resolved `NetworkError` in Tesseract.js v6 by bundling the missing LSTM core files (`tesseract-core-lstm.wasm` and `tesseract-core-simd-lstm.wasm`), which are now required by default.

## [0.3.0] - 2025-11-28

### Changed

- Upgraded Tesseract.js to version 6.0.0 for improved performance and file size.
- Updated bundled core files to Tesseract.js-core v5.1.0 (WASM and SIMD support).
- Configured `createWorker` to use the new v6 API and correctly point to local worker/core resources.

## [0.2.0] - 2025-11-27

### Added

- **UI Modernization:** Increased popup window width to 400px and made the recognized text area (`md-text-field`) flexible to fill available vertical space, improving usability.
- **Popup Refactoring:** Extracted core popup logic from `src/popup.js` into a new, testable module `src/popup-logic.js`.
- **Tests:** Added comprehensive unit tests for popup logic (`test/popup.test.js`), including robust mocking for global objects like `Image`, `Tesseract`, and Chrome APIs.
- **Helpers:** Added `flushAll` helper in tests to reliably manage asynchronous promise and timer resolution.

### Changed

- Refactored `src/popup.js` to act as a thin module entry point that initializes `popup-logic.js`.
- Updated `manifest.json` to include a strict Content Security Policy (CSP) and define web accessible resources for Tesseract.js.
- Updated `src/background.js` to reference the correct path for `src/popup.html`.
- Improved error handling in `src/content.js` for `chrome.runtime.sendMessage`.
- Enhanced error handling for OCR cancellation in `src/popup-logic.js` to prevent "Error: Cancelled" messages.
- `src/popup-logic.js` now imports `MAX_PIXELS` and `MAX_DIMENSION` constants from `src/utils.js` for consistency.

## [0.1.0] - 2025-11-27

### Added

- Initial release of the PrivateOCR Chrome extension.
- Privacy-focused local OCR capability using Tesseract.js (WASM), ensuring no data leaves the browser.
- Full-page screenshot capture and OCR functionality.
- Region selection tool allowing users to crop and OCR specific parts of the page.
- Automatic copying of recognized text to the clipboard.
- Basic offline support with bundled Tesseract worker and language data.
