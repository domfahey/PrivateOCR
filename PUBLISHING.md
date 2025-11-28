# Publishing to the Chrome Web Store

This guide outlines the steps to publish the **Local OCR Screenshot** extension to the Google Chrome Web Store.

## 1. Prepare the Extension for Release

Before uploading, ensure your extension is production-ready.

1.  **Update Version:** Increment the `version` number in `manifest.json` (e.g., from `0.2.0` to `1.0.0`) and update `CHANGELOG.md`.
2.  **Test:** Thoroughly test the extension functionality (screenshot, region select, OCR).
3.  **Clean Up:** Remove any debug code.
4.  **Create a ZIP File:**
    *   You need to zip the contents of the `ocr-local-screenshot-ext` directory, excluding development files.
    *   **Files/Folders to include:**
        *   `manifest.json`
        *   `src/` (All source files: popup, background, content scripts, etc.)
        *   `vendor/` (Tesseract libraries and data)
    *   **Command Line Example (from inside `ocr-local-screenshot-ext`):**
        ```bash
        zip -r local-ocr-extension.zip manifest.json src/ vendor/
        ```

## 2. Create a Developer Account

1.  Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard).
2.  Sign in with your Google Account.
3.  Pay the one-time registration fee if necessary.

## 3. Upload the Extension

1.  In the Developer Dashboard, click **+ New Item**.
2.  Drag and drop the `local-ocr-extension.zip` file.

## 4. Store Listing

*   **Description:** "Runs entirely offline. No data leaves your device."
*   **Permissions:** Justify `activeTab` (capturing screenshots), `scripting` (region overlay), and `storage` (passing image data).
*   **Privacy:** Declare that no user data is collected or transmitted.

## 5. Submit

Click **Submit for Review**.