# How to Install the PrivateOCR Chrome Extension

This document provides instructions on how to load and run the "PrivateOCR" Chrome Extension in your browser. This is a developer installation method, as the extension is not published to the Chrome Web Store.

## Prerequisites
-   Google Chrome browser installed on your system.
-   The extension source code is available locally on your machine.

## Installation Steps

1.  **Open Chrome Extensions Page:**
    *   Open Google Chrome.
    *   Type `chrome://extensions/` in the address bar and press Enter.

2.  **Enable Developer Mode:**
    *   On the Extensions page, locate the **"Developer mode"** toggle switch in the top right corner.
    *   Click the toggle to turn **"Developer mode"** ON. This will enable additional options like "Load unpacked".

3.  **Load Unpacked Extension:**
    *   After enabling Developer mode, you will see a button labeled **"Load unpacked"**. Click it.
    *   A file dialog will appear. Navigate to the directory where the extension's source code is located.
        *   In this project, the extension's source code is located in the `ocr-local-screenshot-ext` folder.
        *   So, select the `ocr-local-screenshot-ext` folder and click "Select".

4.  **Verify Installation:**
    *   Once loaded, the "PrivateOCR" extension should appear in your list of installed extensions.
    *   You should see its name, version, and description.

5.  **Pin the Extension (Optional but Recommended):**
    *   To easily access the extension, click the puzzle piece icon (Extensions icon) in your Chrome toolbar.
    *   Find "PrivateOCR" in the dropdown list and click the pushpin icon next to it to pin it to your toolbar.

## Usage
-   Click the pinned extension icon in your Chrome toolbar to open the popup.
-   From the popup, you can either:
    *   Click "Capture Tab" to perform OCR on the entire visible area of the current tab.
    *   Click "Select Region" to draw a box on the current page and perform OCR on the selected area.

## Troubleshooting
-   **Extension not appearing:** Ensure Developer mode is enabled and you selected the correct `ocr-local-screenshot-ext` folder.
-   **Errors in the extension:** If the extension shows an error or doesn't work as expected, go to `chrome://extensions/`, find the "PrivateOCR" extension, and click the "Errors" button or view the console in the popup's developer tools (right-click the extension icon, then "Inspect popup").
-   **Updates to code:** If you make changes to the extension's source code, you'll need to go to `chrome://extensions/`, find the extension, and click the refresh/reload icon (a circular arrow) to apply the changes.
