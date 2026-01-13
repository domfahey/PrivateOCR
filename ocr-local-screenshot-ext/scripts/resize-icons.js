#!/usr/bin/env node
/**
 * Resize extension icons to fill more of the available space.
 * This removes excess padding so icons appear larger in Chrome toolbar.
 *
 * Usage: node scripts/resize-icons.js
 */

import sharp from "sharp";
import { readdir, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, "..", "icons");
const BACKUP_DIR = join(__dirname, "..", "icons-backup");

// Target sizes for each icon
const ICON_SIZES = {
  "icon16.png": 16,
  "icon32.png": 32,
  "icon48.png": 48,
  "icon128.png": 128,
};

// Padding as percentage of icon size (2px padding on 16px = 12.5%)
// Using ~6% padding means content fills ~88% of space
const PADDING_PERCENT = 0.06;

async function resizeIcon(filename, targetSize) {
  const inputPath = join(ICONS_DIR, filename);
  const padding = Math.round(targetSize * PADDING_PERCENT);
  const contentSize = targetSize - padding * 2;

  console.log(`Processing ${filename}:`);
  console.log(`  Target: ${targetSize}x${targetSize}px`);
  console.log(`  Padding: ${padding}px per side`);
  console.log(`  Content area: ${contentSize}x${contentSize}px`);

  try {
    // Read the original image
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log(`  Original: ${metadata.width}x${metadata.height}px`);

    // Trim transparent pixels to get just the content
    const trimmed = await image.trim().toBuffer({ resolveWithObject: true });

    console.log(`  After trim: ${trimmed.info.width}x${trimmed.info.height}px`);

    // Resize the trimmed content to fit in the content area
    const resized = await sharp(trimmed.data)
      .resize(contentSize, contentSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();

    // Add padding back (extend canvas to full size)
    const final = await sharp(resized)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(inputPath);

    console.log(`  Saved: ${targetSize}x${targetSize}px with ${padding}px padding\n`);
    return true;
  } catch (error) {
    console.error(`  Error processing ${filename}: ${error.message}\n`);
    return false;
  }
}

async function backupIcons() {
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    const files = await readdir(ICONS_DIR);

    for (const file of files) {
      if (file.endsWith(".png")) {
        const src = join(ICONS_DIR, file);
        const dest = join(BACKUP_DIR, file);
        await sharp(src).toFile(dest);
        console.log(`Backed up: ${file}`);
      }
    }
    console.log(`\nBackups saved to: ${BACKUP_DIR}\n`);
  } catch (error) {
    console.error("Backup failed:", error.message);
    process.exit(1);
  }
}

async function main() {
  console.log("=== Icon Resizer ===\n");

  // Backup existing icons first
  console.log("Creating backups...\n");
  await backupIcons();

  // Process each icon
  console.log("Resizing icons...\n");
  for (const [filename, size] of Object.entries(ICON_SIZES)) {
    await resizeIcon(filename, size);
  }

  console.log("Done! Icons have been resized with less padding.");
  console.log("Original icons are backed up in icons-backup/");
}

main().catch(console.error);
