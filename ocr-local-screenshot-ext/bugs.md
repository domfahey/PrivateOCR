# Potential Bugs

## Fixed

- ~~Progress bar stays indeterminate for idle statuses like "Ready" or "No text to copy," because `updateStatus` only hides progress for Done/Error/Cancelled; this likely leaves the UI "loading" when it shouldn't (`src/popup-logic.js:184`).~~ **FIXED**: Changed logic to use a whitelist of processing statuses; all other statuses hide the progress bar.
- ~~`getWorker()` caches `workerPromise` but never resets it on failure, so a single init error permanently blocks future OCR attempts until reload (`src/popup-logic.js:214`).~~ **FIXED**: Added `.catch()` handler to reset `workerPromise` and `currentWorker` on failure, allowing retry.
- ~~Region captures skip `scaleImageIfNeeded`, so selecting a very large region can create huge canvases and risk memory/perf issues compared to full-tab capture (`src/popup-logic.js:510`).~~ **FIXED**: `handleRegionCapture` now calls `scaleImageIfNeeded` on cropped images before OCR.

- ~~Preview image CSS targets `#preview-image`, but the actual element id is `previewImage`, so max-height/object-fit styles never apply (`src/styles.css:174`, `src/popup.html:95`).~~ **FIXED**: Changed CSS selector from `#preview-image` to `#previewImage`.
- ~~Region mode opens a fixed 400x400 popup window, but the UI enforces `min-width: 780px` and `min-height: 580px`, likely causing clipped or unusable layouts in region mode (`src/background.js:36`, `src/styles.css:34`).~~ **FIXED**: Changed popup window size to 800x600 to accommodate UI minimum dimensions.
- ~~Region selection cancels silently for tiny drags, leaving the popup closed and no feedback to the user after `handleRegionClick()` closes it (`src/content.js:108`, `src/popup-logic.js:96`).~~ **FIXED**: Added `regionCancelled` message and Chrome notification to inform user when selection is too small.
- ~~`.preview-toolbar` is absolutely positioned but `.preview-container` lacks `position: relative`, so the toolbar can anchor to the page instead of the preview pane (`src/styles.css:122`, `src/styles.css:138`).~~ **FIXED**: Added `position: relative` to `.preview-container`.

## Open

- Region capture persists screenshot data in `chrome.storage.local`, which writes to disk and can linger if the region popup never opens, conflicting with the "memory only" privacy promise (`src/background.js:25`, `src/popup-logic.js:1`). Note: Storage is cleared after popup reads it, but data persists if popup fails to open.
- Region mode stores a full screenshot data URL in `chrome.storage.local`, which can exceed quota limits (no `unlimitedStorage`) and fail for large/high-DPI captures without user-visible recovery (`src/background.js:25`).
- When the popup is reopened in region mode, `chrome.tabs.query({ active: true, currentWindow: true })` targets the popup window; "Capture Tab" OCRs the popup itself and "Select Region" errors on the `chrome-extension://` URL instead of the original page (`src/popup-logic.js:406`, `src/popup-logic.js:487`).
- The overlay only calls `preventDefault` on mouse events, so page-level handlers still run; site scripts can intercept selection gestures and interfere with or cancel the overlay (`src/content.js:63`, `src/content.js:75`, `src/content.js:93`).
- Rapid double-clicks on Copy can leave the button stuck on "Copied!" because overlapping timeouts restore stale HTML in different orders (`src/popup-logic.js:559`).
- Background errors during region capture are only logged; the user gets no UI feedback because the popup never opens (`src/background.js:42`).
- Cancelling region selection with Escape closes the overlay but never reopens the popup or shows feedback, leaving the user stuck (`src/content.js:46`, `src/popup-logic.js:513`).
- Selection sizes are validated before viewport clamping; after clamping, width/height can drop below minimum and still proceed, leading to zero-sized crops (`src/content.js:108`, `src/content.js:114`).
- `isProcessing` is only set once OCR starts, so users can click Capture repeatedly during screenshot capture/scaling and trigger overlapping runs (`src/popup-logic.js:443`, `src/popup-logic.js:463`).
- The cancel button is hidden during capture/scaling/cropping; long operations can’t be aborted until OCR begins (`src/popup-logic.js:171`, `src/popup-logic.js:443`).
- `updateStatus` logs every status via `console.log`, including OCR progress; this can expose user activity timing in shared logs and conflicts with “no logging” expectations (`src/popup-logic.js:206`).
