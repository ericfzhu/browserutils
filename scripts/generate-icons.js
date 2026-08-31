import sharp from 'sharp';
import { copyFile, mkdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');
const iconSource = join(iconsDir, 'icon.svg');
const sitePublicDir = join(__dirname, '..', 'site', 'public');

const sizes = [16, 32, 48, 128];

async function generateIcons() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(sitePublicDir, { recursive: true });
  const shieldSvg = await readFile(iconSource);

  for (const size of sizes) {
    const outputPath = join(iconsDir, `icon${size}.png`);
    await sharp(shieldSvg)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated ${outputPath}`);
  }

  await copyFile(iconSource, join(sitePublicDir, 'favicon.svg'));

  console.log('All icons generated!');
}

generateIcons().catch(console.error);
