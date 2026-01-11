# Potential Bugs

## Fixed

- ~~Progress bar stays indeterminate for idle statuses like "Ready" or "No text to copy," because `updateStatus` only hides progress for Done/Error/Cancelled; this likely leaves the UI "loading" when it shouldn't (`src/popup-logic.js:184`).~~ **FIXED**: Changed logic to use a whitelist of processing statuses; all other statuses hide the progress bar.
- ~~`getWorker()` caches `workerPromise` but never resets it on failure, so a single init error permanently blocks future OCR attempts until reload (`src/popup-logic.js:214`).~~ **FIXED**: Added `.catch()` handler to reset `workerPromise` and `currentWorker` on failure, allowing retry.
- ~~Region captures skip `scaleImageIfNeeded`, so selecting a very large region can create huge canvases and risk memory/perf issues compared to full-tab capture (`src/popup-logic.js:510`).~~ **FIXED**: `handleRegionCapture` now calls `scaleImageIfNeeded` on cropped images before OCR.

## Open
- Preview image CSS targets `#preview-image`, but the actual element id is `previewImage`, so max-height/object-fit styles never apply (`src/styles.css:174`, `src/popup.html:95`).
- Region mode opens a fixed 400x400 popup window, but the UI enforces `min-width: 780px` and `min-height: 580px`, likely causing clipped or unusable layouts in region mode (`src/background.js:36`, `src/styles.css:34`).
- Region selection cancels silently for tiny drags, leaving the popup closed and no feedback to the user after `handleRegionClick()` closes it (`src/content.js:108`, `src/popup-logic.js:96`).
- Region capture persists screenshot data in `chrome.storage.local`, which writes to disk and can linger if the region popup never opens, conflicting with the “memory only” privacy promise (`src/background.js:25`, `src/popup-logic.js:1`).
- `.preview-toolbar` is absolutely positioned but `.preview-container` lacks `position: relative`, so the toolbar can anchor to the page instead of the preview pane (`src/styles.css:122`, `src/styles.css:138`).
