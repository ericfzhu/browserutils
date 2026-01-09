import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');

// Shield SVG with blue gradient
const shieldSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none">
  <defs>
    <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb"/>
      <stop offset="100%" style="stop-color:#4f46e5"/>
    </linearGradient>
  </defs>
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" fill="url(#shieldGradient)" stroke="url(#shieldGradient)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const sizes = [16, 32, 48, 128];

async function generateIcons() {
  await mkdir(iconsDir, { recursive: true });

  for (const size of sizes) {
    const outputPath = join(iconsDir, `icon${size}.png`);
    await sharp(Buffer.from(shieldSvg))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated ${outputPath}`);
  }

  console.log('All icons generated!');
}

generateIcons().catch(console.error);
