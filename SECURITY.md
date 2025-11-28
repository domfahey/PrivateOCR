# Security Policy for Local OCR Screenshot Extension

This document outlines the security and privacy policies for the Local OCR Screenshot Chrome Extension. Our core principle is to ensure that **no user data, especially sensitive image or text data, ever leaves the user's browser.**

## 1. Privacy by Design: Local Processing Only

The Local OCR Screenshot extension is designed with user privacy as its highest priority.

-   **All OCR Processing is Local**: The core OCR functionality is performed entirely within your browser using the bundled [Tesseract.js](https://tesseract.projectnaptha.com/) library. No screenshots, images, or extracted text are ever sent to remote servers for processing.
-   **No Network Requests for Data**: Beyond fetching the extension files themselves from the Chrome Web Store (or local installation), the extension makes no outbound network requests that transmit user-generated content or personal data.

## 2. No Telemetry or Analytics

-   **Zero Telemetry**: We do not collect any usage statistics, analytics, crash reports, or other forms of telemetry data.
-   **No User Tracking**: There is no tracking of user activity within the extension.

## 3. Data Handling

-   **Ephemeral Data**: Screenshots and recognized text are handled ephemerally. They reside in the browser's memory only for the duration of the OCR process or until cleared.
-   **No Persistent Storage of Content**: The extension does not persistently store user screenshots or recognized text on your local disk or in browser storage (e.g., `localStorage`, `IndexedDB`).
-   **Temporary Storage for Region Selection**: For region selection (where the popup closes and re-opens), the captured screenshot and region coordinates are temporarily stored in `chrome.storage.local`. This data is **immediately removed** once the popup re-opens and processes the request, and it expires after 60 seconds if not processed. This is purely for inter-process communication within the browser and is not persisted.

## 4. Chrome Extension Permissions

The extension requests the minimum necessary permissions to function, and these permissions are used strictly in accordance with our privacy policy.

-   **`activeTab`**: Allows temporary access to the currently active tab when the user invokes the extension. This is necessary to:
    -   Capture a screenshot of the visible area of the active tab (`chrome.tabs.captureVisibleTab`).
    -   Query information about the active tab (`chrome.tabs.query`) to determine if content scripts can be injected.
-   **`scripting`**: Required to inject our `content.js` script into the active page when the user selects "Select Region". This script creates the selection overlay and captures user input.
-   **`storage`**: Used exclusively for temporary, short-lived storage of screenshot data and region coordinates during the region selection workflow. This data is removed immediately after use.

## 5. Content Security Policy (CSP)

The `manifest.json` includes a strict Content Security Policy (`script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`). This policy is designed to:
-   Restrict script execution to only scripts bundled with the extension.
-   Allow WebAssembly (`wasm-unsafe-eval`) which is required by Tesseract.js for performance.
-   Prevent the loading of remote scripts or resources that could potentially compromise security or privacy.

## 6. Reporting Security Issues

If you discover a security vulnerability or have concerns about the extension's privacy practices, please report them by opening an issue on the project's GitHub repository.

## 7. Contribution Guidelines

Contributors are expected to adhere strictly to these security and privacy principles. Any changes involving data handling, network requests, or permissions will undergo thorough review to ensure continued compliance with this policy.