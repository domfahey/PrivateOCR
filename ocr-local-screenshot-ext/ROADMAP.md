# PrivateOCR Roadmap

Feature roadmap for PrivateOCR based on competitive analysis and user needs.

## Current Version: v0.5.3

**Core Features:**
- Full-page screenshot OCR
- Region selection (draw rectangle on page)
- Auto-copy to clipboard
- 100% offline processing
- Modern Material Design UI

---

## v0.6.0 - Input Methods

### Context Menu OCR
Right-click on any image in a webpage to extract text.
- Add `contextMenus` permission
- "Extract text from image" menu item
- Opens popup with OCR result

### File Upload / Drag-and-Drop
Import images directly into the popup.
- Drag-and-drop zone in popup
- File picker button
- Support common image formats (PNG, JPG, WebP, GIF)

### Clipboard Paste
Paste screenshots directly from clipboard.
- "Paste from clipboard" button
- `Ctrl+V` / `Cmd+V` support in popup
- Handle `image/*` MIME types

---

## v0.7.0 - Accuracy & Feedback

### Confidence Indicator
Show OCR accuracy percentage in results.
- Display confidence score after OCR
- Visual indicator (color-coded)
- Help users know when to retry

### Dark Theme Inversion
Auto-retry with inverted colors for better accuracy on dark backgrounds.
- Detect low confidence results
- Automatically invert and re-process
- Show best result

### Keyboard Shortcuts
Quick capture without clicking.
- `Ctrl+Shift+O` - Full page capture
- `Ctrl+Shift+R` - Region selection
- Configurable in settings

---

## v0.8.0 - Document Support

### PDF OCR
Extract text from PDF documents.
- Use PDF.js to render pages
- Process each page through Tesseract
- Combine results with page breaks

### Multi-Page Support
Handle documents with multiple pages.
- Page navigation in preview
- Export all pages or selection

---

## v1.0.0 - Multi-Platform

### Firefox Extension
Port extension to Firefox.
- Adapt manifest for Firefox
- Test all features
- Publish to Firefox Add-ons

### Edge Extension
Port extension to Microsoft Edge.
- Minimal changes from Chrome version
- Publish to Edge Add-ons

---

## Future Considerations

### Multi-Language Support
Support additional OCR languages beyond English.
- Language selector in settings
- On-demand language pack downloads
- Top languages: Spanish, French, German, Chinese, Japanese

### Translation Integration
Translate extracted text.
- Optional API integration
- Translate button after OCR

### History / Recent Captures
Store and access previous OCR results.
- Last 10 captures in IndexedDB
- History tab in popup
- Re-copy or re-process

### Export Formats
Multiple output formats.
- Plain text (current)
- Markdown
- JSON with bounding boxes

---

## Contributing

Want to help implement a feature? See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
