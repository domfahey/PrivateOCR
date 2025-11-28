# Local OCR Screenshot

A privacy-focused Chrome extension that extracts text from screenshots using local OCR. All processing happens in your browser using [Tesseract.js](https://tesseract.projectnaptha.com/) - no data leaves your device.

## Features

- **Full-page OCR**: Capture the visible tab and extract text
- **Region selection**: Draw a rectangle to OCR a specific area
- **Auto-copy**: Text is automatically copied to your clipboard
- **100% offline**: All resources bundled, no network requests

## Installation

1. Clone this repository
2. Run `npm install`
3. Open `chrome://extensions/` and enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## Usage

**Full-page**: Click extension icon → "Capture Tab"

**Region**: Click extension icon → "Select Region" → draw rectangle on page

Press `Escape` to cancel region selection. Use the Cancel button to stop long-running OCR.

## Project Structure

```
├── src/           # Extension source (popup, background, content scripts)
├── vendor/        # Third-party libraries (Tesseract.js, language data)
├── test/          # Test files
└── manifest.json  # Chrome extension manifest
```

## Development

```bash
npm install          # Install dependencies
npm test             # Run tests
npm run lint         # ESLint
npm run format       # Prettier
```

## Privacy

- No network requests - Tesseract.js bundled in `vendor/`
- Minimal permissions: `activeTab`, `scripting`, `storage`
- OCR text never logged

## License

MIT
