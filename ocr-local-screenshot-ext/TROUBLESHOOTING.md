# Troubleshooting

Common issues and solutions for PrivateOCR.

## OCR Accuracy Issues

### Blurry or Low-Quality Text

**Symptoms:** OCR returns garbled text, wrong characters, or misses text entirely.

**Solutions:**

- Zoom in on the webpage before capturing to increase text size
- Use "Select Region" to capture only the text area (avoids processing unnecessary images)
- Ensure the page is fully loaded before capturing
- High-contrast text (dark on light or light on dark) works best

### Small Text Not Recognized

**Symptoms:** Very small text (e.g., footnotes, fine print) is missing or incorrect.

**Solutions:**

- Use browser zoom (Ctrl/Cmd + Plus) to enlarge the text before capturing
- Use the region selection to capture a smaller area at higher detail
- Text smaller than ~10px may not be reliably recognized

### Non-English Text

**Symptoms:** Non-Latin characters are not recognized.

**Solutions:**

- The default installation only includes English (`eng.traineddata`)
- Additional language data can be added to `vendor/tessdata/` from [tessdata_best](https://github.com/tesseract-ocr/tessdata_best)

## Region Selection Problems

### "Cannot select region on this page"

**Cause:** Chrome restricts extensions from running on certain pages.

**Affected pages:**

- `chrome://` URLs (settings, extensions, etc.)
- `chrome-extension://` URLs
- The Chrome Web Store
- `about:` pages

**Solution:** Navigate to a regular webpage to use region selection.

### Selection Disappears Immediately

**Symptoms:** The overlay appears but closes without capturing.

**Solutions:**

- Ensure you click and drag (not just click)
- The selection must be at least 10×10 pixels
- Try selecting a larger area

### Region Not Aligned with Selection

**Symptoms:** The captured region doesn't match where you drew the box.

**Cause:** High-DPI (Retina) display scaling issues.

**Solutions:**

- The extension accounts for DPI automatically; if issues persist, try setting browser zoom to 100%
- Close and reopen the extension if the display scaling changed during the session

### "Region data not found"

**Symptoms:** The popup reopens and shows a message that region data is missing or expired.

**Cause:** The temporary capture data was cleared before the popup could process it.

**Solutions:**

- Try the region selection again and complete the selection promptly
- If the popup was already open, close it and retry the region capture

## Extension Problems

### Extension Not Loading

**Symptoms:** Icon is grayed out or doesn't respond to clicks.

**Solutions:**

1. Go to `chrome://extensions/`
2. Find "PrivateOCR" and check for error messages
3. Click the refresh icon to reload the extension
4. If errors persist, remove and re-add the extension

### "Errors" Badge on Extension

**Steps to diagnose:**

1. Go to `chrome://extensions/`
2. Click "Errors" under the extension
3. Review the error messages

**Common errors:**

- **"Could not load javascript"**: Reinstall the extension
- **"Service worker registration failed"**: Clear browser data and reload

### OCR Takes Too Long

**Cause:** Large images require more processing time.

**Solutions:**

- Use region selection to capture smaller areas
- The first OCR operation is slower (loading the engine); subsequent operations are faster
- Large screenshots (>5MP) are automatically scaled down

### "Error: Cannot access this tab"

**Cause:** The tab is restricted or has unusual permissions.

**Solutions:**

- Refresh the page and try again
- Check if the site uses special security headers that block extensions
- Try on a different tab to verify the extension works

## Performance Tips

### Faster OCR

1. **Use region selection** - Smaller images process faster
2. **Wait for the engine to load** - The first OCR takes longer; subsequent operations reuse the loaded engine
3. **Avoid very large pages** - Full-page captures of long pages will be slower

### Memory Usage

- The OCR engine uses WebAssembly and requires ~50-100MB of memory
- Close other memory-intensive tabs if you experience slowdowns
- The worker is terminated when you cancel an operation

## Getting Help

If your issue isn't listed here:

1. Open the browser console (Right-click extension icon → "Inspect popup") to check for errors
2. Note the exact error message and steps to reproduce
3. File an issue at the project repository with these details
