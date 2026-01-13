# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                              # Run all tests
npx vitest run test/utils.test.js     # Single file
npx vitest run -t "dataUrlToBlob"     # Pattern match
npm run lint && npm run format        # Lint and format
```

## Project Structure

```
├── src/                 # Extension source code
│   ├── popup.html/js    # Main UI and OCR logic
│   ├── background.js    # Service worker
│   ├── content.js       # Region selection overlay
│   ├── styles.css
│   └── utils.js         # Testable utilities (ES module)
├── vendor/              # Third-party libraries
│   ├── tesseract/       # Tesseract.js files
│   └── tessdata/        # Language data
├── test/                # Vitest tests
└── manifest.json        # Chrome extension manifest
```

## Architecture

Chrome Manifest V3 extension for local OCR using Tesseract.js. No network requests.

**Full-page OCR:**

```
popup-logic.js → captureVisibleTab → scaleImageIfNeeded → Tesseract worker → clipboard
```

**Region selection:**

```
popup-logic.js injects content.js → user draws rect → content.js → background.js
→ captureVisibleTab → chrome.storage.local → opens popup?regionMode=true
→ popup-logic.js reads storage, crops, runs OCR
```

## Code Notes

**popup.js is a small ES module** that wires DOM elements into `popup-logic.js`. Keep testable logic in `src/popup-logic.js` and `src/utils.js`.

**Shared utilities**: `popup-logic.js` imports utility functions (`dataUrlToBlob`, `scaleImageIfNeeded`, `copyToClipboard`) from `utils.js`. The constants `MAX_PIXELS` (5MP) and `MAX_DIMENSION` (3000px) are defined in `utils.js` and used internally by `scaleImageIfNeeded`.

**Privacy rules**:

- Use `dataUrlToBlob()` instead of `fetch()` for data URLs
- Never log OCR text content or screenshot data
