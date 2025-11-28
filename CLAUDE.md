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
popup.js → captureVisibleTab → scaleImageIfNeeded → Tesseract worker → clipboard
```

**Region selection:**

```
popup.js injects content.js → user draws rect → content.js → background.js
→ captureVisibleTab → chrome.storage.local → opens popup?regionMode=true
→ popup.js reads storage, crops, runs OCR
```

## Code Notes

**popup.js is a browser script** (not ES module), cannot be imported in tests. Testable logic goes in `src/utils.js`.

**Duplicate constants**: `popup.js` uses 2MP/2000px limits, `utils.js` uses 5MP/3000px. Runtime uses popup.js values.

**Privacy rules**:

- Use `dataUrlToBlob()` instead of `fetch()` for data URLs
- Never log OCR text content or screenshot data
