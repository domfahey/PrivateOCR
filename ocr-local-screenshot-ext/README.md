# PrivateOCR

A privacy-focused Chrome extension that extracts text from screenshots using local OCR. All processing happens directly in your browser using [Tesseract.js](https://tesseract.projectnaptha.com/) ([GitHub](https://github.com/naptha/tesseract.js)) (WASM).

**No data leaves your device.**

## Features

- **100% Offline & Private**: All OCR resources are bundled. No images or text are sent to external servers.
- **Full-Page OCR**: Instantly capture and extract text from the visible tab area.
- **Region Selection**: Draw a custom rectangle on any page to extract text from a specific area.
- **Auto-Copy**: Recognized text is automatically copied to your clipboard.
- **Modern UI**: Clean, responsive Material Design interface.

## Installation (Developer Mode)

Since this extension is not yet in the Chrome Web Store, you must load it manually:

1.  **Clone** or download this repository.
2.  Navigate to the `ocr-local-screenshot-ext` directory and run:
    ```bash
    npm install
    ```
3.  Open Chrome and go to `chrome://extensions/`.
4.  Toggle **"Developer mode"** in the top right corner.
5.  Click **"Load unpacked"**.
6.  Select the `ocr-local-screenshot-ext` folder.

For more detailed instructions, see [INSTALL.md](../INSTALL.md).

## Usage

1.  **Pin the extension** to your toolbar for easy access.
2.  **Full Page**: Click the extension icon -> **"Capture Tab"**.
3.  **Specific Area**: Click **"Select Region"** -> Click and drag on the webpage to select text.
4.  The text will be extracted and copied to your clipboard automatically.

## Development

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on setting up the environment, running tests, and understanding the architecture.

### Quick Commands

```bash
npm test             # Run unit tests
npm run lint:fix     # Fix linting issues
npm run format       # Format code
```

## License

MIT
