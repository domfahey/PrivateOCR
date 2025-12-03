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
 * @throws {Error} If the data URL is malformed
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    throw new Error("Invalid data URL: must be a non-empty string");
  }
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid data URL: missing comma separator");
  }
  const dataUrlHeader = dataUrl.slice(0, commaIndex);
  const base64Content = dataUrl.slice(commaIndex + 1);
  const mimeMatch = dataUrlHeader.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  try {
    const binary = atob(base64Content);
    // Pre-allocate Uint8Array for better performance than Uint8Array.from with callback
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch (err) {
    throw new Error("Invalid data URL: failed to decode base64 content");
  }
}

/**
 * Scale image if it exceeds size limits
 * @param {string} dataUrl - The image data URL
 * @returns {Promise<{dataUrl: string, scaled: boolean}>}
 */
export function scaleImageIfNeeded(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const { width, height } = image;
      const totalPixels = width * height;

      // Check if scaling is needed
      if (totalPixels <= MAX_PIXELS && width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve({ dataUrl, scaled: false });
        return;
      }

      // Calculate scale factor
      let scaleFactor = 1;
      if (totalPixels > MAX_PIXELS) {
        scaleFactor = Math.sqrt(MAX_PIXELS / totalPixels);
      }
      if (width * scaleFactor > MAX_DIMENSION) {
        scaleFactor = MAX_DIMENSION / width;
      }
      if (height * scaleFactor > MAX_DIMENSION) {
        scaleFactor = MAX_DIMENSION / height;
      }

      const scaledWidth = Math.floor(width * scaleFactor);
      const scaledHeight = Math.floor(height * scaleFactor);

      // Scale on canvas
      const canvas = document.createElement("canvas");
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) {
        resolve({ dataUrl, scaled: false });
        return;
      }
      canvasContext.drawImage(image, 0, 0, scaledWidth, scaledHeight);

      resolve({ dataUrl: canvas.toDataURL("image/png"), scaled: true });
    };
    image.onerror = () => resolve({ dataUrl, scaled: false });
    image.src = dataUrl;
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
  } catch (error) {
    console.error("Clipboard error:", error);
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
  // Allow optional MIME type: data:;base64, or data:image/png;base64,
  return /^data:[^;]*;base64,/.test(dataUrl);
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
