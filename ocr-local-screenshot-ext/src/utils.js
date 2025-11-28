/**
 * Utility functions for Local OCR Screenshot extension
 * Exported for testing
 */

// Image size limits for performance
export const MAX_PIXELS = 5000000; // 5 megapixels max
export const MAX_DIMENSION = 3000; // Max width or height

/**
 * Convert data URL to Blob without using fetch
 * This avoids any network semantics and makes it clear no network is involved
 * @param {string} dataUrl - The data URL to convert
 * @returns {Blob} The resulting Blob
 */
export function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Scale image if it exceeds size limits
 * @param {string} dataUrl - The image data URL
 * @returns {Promise<{dataUrl: string, scaled: boolean}>}
 */
export function scaleImageIfNeeded(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const pixels = width * height;

      // Check if scaling is needed
      if (pixels <= MAX_PIXELS && width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve({ dataUrl, scaled: false });
        return;
      }

      // Calculate scale factor
      let scale = 1;
      if (pixels > MAX_PIXELS) {
        scale = Math.sqrt(MAX_PIXELS / pixels);
      }
      if (width * scale > MAX_DIMENSION) {
        scale = MAX_DIMENSION / width;
      }
      if (height * scale > MAX_DIMENSION) {
        scale = MAX_DIMENSION / height;
      }

      const newWidth = Math.floor(width * scale);
      const newHeight = Math.floor(height * scale);

      // Scale on canvas
      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      resolve({ dataUrl: canvas.toDataURL("image/png"), scaled: true });
    };
    img.onerror = () => resolve({ dataUrl, scaled: false });
    img.src = dataUrl;
  });
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Whether copy succeeded
 */
export async function copyToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Clipboard error:", err);
    return false;
  }
}

/**
 * Count words in text
 * @param {string} text - Text to count words in
 * @returns {number} - Word count
 */
export function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Validate that a data URL is properly formatted
 * @param {string} dataUrl - The data URL to validate
 * @returns {boolean} - Whether the data URL is valid
 */
export function isValidDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return false;
  return /^data:[^;]+;base64,/.test(dataUrl);
}

/**
 * Create a File object from a Blob
 * @param {Blob} blob - The blob to convert
 * @param {string} filename - The filename to use
 * @returns {File} - The resulting File object
 */
export function blobToFile(blob, filename = "image.png") {
  return new File([blob], filename, { type: blob.type });
}
