# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Initial release of the Local OCR Screenshot Chrome extension.
- Privacy-focused local OCR capability using Tesseract.js (WASM), ensuring no data leaves the browser.
- Full-page screenshot capture and OCR functionality.
- Region selection tool allowing users to crop and OCR specific parts of the page.
- Automatic copying of recognized text to the clipboard.
- Basic offline support with bundled Tesseract worker and language data.
