# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.2] - 2026-01-12

### Fixed

- **Data URL Validation**: `isValidDataUrl` now accepts data URLs with additional parameters like `charset=utf-8` before `;base64,`.
- **Region Mode Safety**: Screenshot button is now disabled when region data is missing, preventing accidental capture of the popup window itself.
- **Dead Code Removal**: Removed unused `sourceTabId` from stored region data.
- **Region Scaling Status**: "Scaling large image..." message now appears BEFORE the scaling operation in region mode, not after.

### Changed

- **Test Coverage**: Added 6 new tests for edge cases; 191 tests now passing.

## [0.5.1] - 2026-01-12

### Fixed

- **Pointer Events**: Converted region selection from mouse events to Pointer Events API with `setPointerCapture()`, fixing stuck overlay when mouse is released outside browser window.
- **Overlay in Screenshots**: Added `requestAnimationFrame()` delay before capturing to ensure selection overlay is visually removed from screenshots.
- **Storage Quota**: Added `unlimitedStorage` permission to prevent quota errors on high-DPI screens; pre-clean storage before new captures.
- **Settings UI**: Removed non-functional language dropdown; replaced with informational "OCR Engine" section.
- **Progress Bar Timeout**: Added timeout tracking to prevent stale timeouts from hiding active progress bars.
- **Tesseract Logger**: Fixed logger to always pass progress value (0.5) for statuses without explicit progress, keeping progress bar visible.
- **Capture Errors**: Error handlers now reset progress bar state by calling `updateStatus` with progress 0.
- **Text Zoom Reset**: Text zoom now resets to 15px at start of each new OCR operation.
- **Image Zoom**: Added explicit `maxHeight` management in `applyImageZoom()` to fix zoom appearing broken on tall images.
- **Cancellation**: Added cancellation checks after capture, crop, and scale operations for responsive cancel behavior.
- **Async Window Create**: Added `await` to `chrome.windows.create()` call to properly catch popup creation failures.
- **Null Checks**: Added null guards to `updatePreview()` and all button event listeners to prevent crashes.
- **Region Data Feedback**: Added user feedback when region data is missing or expired in region mode.
- **Message Response**: Added `sendResponse()` call before async `handleRegionSelection` to prevent "message port closed" errors.
- **Privacy**: Removed `console.log` from `updateStatus()` to prevent status messages appearing in logs.
- **Periodic Cleanup**: Added `chrome.alarms` API for periodic stale data cleanup every 5 minutes.
- **Event Propagation**: Added `stopPropagation()` to all pointer event handlers to prevent page scripts from intercepting selection.
- **Clipboard Permission**: Added `clipboardWrite` permission for reliable auto-copy without user gesture requirement.
- **Stale Data Cleanup**: Normal popup opens now clear any lingering `pendingRegionOcr` data from storage.

### Changed

- **New Permissions**: Added `unlimitedStorage`, `alarms`, and `clipboardWrite` permissions to manifest.

## [0.5.0] - 2026-01-11

### Added

- **Extension Icons**: Added proper icon assets (16px, 48px, 128px) for toolbar, notifications, and Chrome Web Store.
- **Settings Page**: Added dedicated settings page accessible via gear icon in popup header.
- **Zoom Controls**: Added image zoom (+/−/Fit) and text zoom (A+/A−) controls in popup toolbar.
- **Split View Toggle**: Added button to show/hide screenshot preview panel.
- **User Notifications**: Added Chrome notifications for region selection cancellation and capture errors.
- **Stale Data Cleanup**: Background service worker now cleans up pending region data older than 60 seconds on startup.

### Fixed

- **Region Popup Self-Capture**: Region mode popup now correctly captures the original tab instead of itself by storing and using the source window ID.
- **Progress Bar**: Progress bar now correctly hides for idle statuses (Ready, No text, etc.) instead of staying indeterminate.
- **Worker Recovery**: Tesseract worker initialization now properly resets on failure, allowing retry instead of permanent block.
- **Region Scaling**: Region captures now apply `scaleImageIfNeeded` like full-page captures to prevent memory issues with large selections.
- **CSS Selectors**: Fixed `#previewImage` CSS selector to match actual HTML element ID.
- **Popup Window Size**: Region mode popup now opens at 800x600 to accommodate UI minimum dimensions (780x580).
- **Preview Container**: Added `position: relative` to `.preview-container` so toolbar positions correctly.
- **Copy Button Race**: Fixed race condition where rapid clicks could leave button stuck on "Copied!".
- **Escape Cancellation**: Pressing Escape during region selection now shows notification and properly closes overlay.
- **Viewport Clamping**: Selection size validation now happens after viewport clamping to prevent zero-sized crops.
- **Processing State**: `isProcessing` flag now set immediately on capture start, preventing overlapping operations.
- **Cancel Button Visibility**: Cancel button now visible immediately when capture starts, not just during OCR.

### Changed

- **UI Design**: Modernized popup with "Secure Vault" aesthetic featuring dark theme, improved typography, and refined layout.
- **Test Coverage**: Improved test coverage from 86% to 90% with comprehensive tests for all bug fixes.

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
