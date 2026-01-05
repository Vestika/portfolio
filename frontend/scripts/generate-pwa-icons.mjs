#!/usr/bin/env node
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRONTEND_DIR = join(__dirname, '..');
const LOGO_PATH = join(FRONTEND_DIR, 'src', 'assets', 'logo.png');
const PUBLIC_DIR = join(FRONTEND_DIR, 'public');

// Vestika brand colors (from the design)
const BACKGROUND_COLOR = { r: 17, g: 24, b: 39, alpha: 1 }; // gray-900

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

async function generateIcons() {
  try {
    // Ensure public directory exists
    await mkdir(PUBLIC_DIR, { recursive: true });

    console.log('🎨 Generating PWA icons from logo...');

    // Read the original logo
    const logoBuffer = await sharp(LOGO_PATH)
      .resize(32, 32, { fit: 'contain' })
      .toBuffer();

    // Generate each icon size
    for (const { size, name } of sizes) {
      console.log(`  📐 Creating ${name} (${size}x${size}px)...`);

      // Calculate logo size (80% of icon size, centered)
      const logoSize = Math.floor(size * 0.6);
      const padding = Math.floor((size - logoSize) / 2);

      // Resize logo to fit the icon
      const resizedLogo = await sharp(logoBuffer)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toBuffer();

      // Create icon with background and centered logo
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: BACKGROUND_COLOR
        }
      })
      .composite([
        {
          input: resizedLogo,
          top: padding,
          left: padding
        }
      ])
      .png()
      .toFile(join(PUBLIC_DIR, name));

      console.log(`  ✅ ${name} created`);
    }

    console.log('\n🎉 All PWA icons generated successfully!');
    console.log(`📁 Icons saved to: ${PUBLIC_DIR}`);

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
