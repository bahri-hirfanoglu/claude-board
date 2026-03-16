import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#DA7756"/>
      <stop offset="100%" style="stop-color:#c4624a"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <!-- Board grid pattern -->
  <g opacity="0.12">
    <rect x="60" y="130" width="100" height="320" rx="12" fill="white"/>
    <rect x="180" y="130" width="100" height="320" rx="12" fill="white"/>
    <rect x="300" y="130" width="100" height="320" rx="12" fill="white"/>
  </g>
  <!-- Star symbol -->
  <g filter="shadow">
    <path d="M256 80 L270 180 L370 180 L288 235 L315 340 L256 278 L197 340 L224 235 L142 180 L242 180 Z"
          fill="white" opacity="0.95"/>
  </g>
  <!-- Task cards -->
  <g opacity="0.9">
    <rect x="76" y="180" width="68" height="16" rx="4" fill="white" opacity="0.8"/>
    <rect x="76" y="204" width="50" height="16" rx="4" fill="white" opacity="0.5"/>
    <rect x="76" y="340" width="68" height="16" rx="4" fill="white" opacity="0.5"/>

    <rect x="196" y="200" width="68" height="16" rx="4" fill="#fbbf24" opacity="0.9"/>
    <rect x="196" y="224" width="50" height="16" rx="4" fill="white" opacity="0.5"/>

    <rect x="316" y="180" width="68" height="16" rx="4" fill="#34d399" opacity="0.9"/>
    <rect x="316" y="204" width="50" height="16" rx="4" fill="white" opacity="0.5"/>
    <rect x="316" y="300" width="68" height="16" rx="4" fill="#34d399" opacity="0.9"/>
    <rect x="316" y="324" width="50" height="16" rx="4" fill="white" opacity="0.5"/>
  </g>
  <!-- CB text -->
  <text x="256" y="470" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="800" fill="white" opacity="0.9" letter-spacing="4">CB</text>
</svg>`;

// Simple ICO file generator (no external deps)
function createIco(pngBuffers, sizes) {
  const numImages = pngBuffers.length;
  const headerSize = 6 + numImages * 16;
  let totalSize = headerSize;
  const offsets = [];

  for (const buf of pngBuffers) {
    offsets.push(totalSize);
    totalSize += buf.length;
  }

  const ico = Buffer.alloc(totalSize);
  // ICO header
  ico.writeUInt16LE(0, 0); // reserved
  ico.writeUInt16LE(1, 2); // ICO type
  ico.writeUInt16LE(numImages, 4); // number of images

  for (let i = 0; i < numImages; i++) {
    const offset = 6 + i * 16;
    const size = sizes[i] >= 256 ? 0 : sizes[i]; // 0 means 256
    ico.writeUInt8(size, offset); // width
    ico.writeUInt8(size, offset + 1); // height
    ico.writeUInt8(0, offset + 2); // color palette
    ico.writeUInt8(0, offset + 3); // reserved
    ico.writeUInt16LE(1, offset + 4); // color planes
    ico.writeUInt16LE(32, offset + 6); // bits per pixel
    ico.writeUInt32LE(pngBuffers[i].length, offset + 8); // image size
    ico.writeUInt32LE(offsets[i], offset + 12); // image offset
  }

  for (let i = 0; i < numImages; i++) {
    pngBuffers[i].copy(ico, offsets[i]);
  }

  return ico;
}

async function generateIcons() {
  mkdirSync(buildDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Generate multiple sizes
  const sizes = [512, 256, 128, 64, 32, 16];

  for (const size of sizes) {
    await page.setViewport({ width: size, height: size });
    await page.setContent(`
      <html>
        <body style="margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden">
          ${SVG.replace(/width="512"/g, `width="${size}"`).replace(/height="512"/g, `height="${size}"`)}
        </body>
      </html>
    `);
    const buffer = await page.screenshot({ type: 'png', omitBackground: true });
    writeFileSync(join(buildDir, `icon-${size}.png`), buffer);
    console.log(`Generated icon-${size}.png`);
  }

  // Main icon for electron-builder (512x512)
  const { copyFileSync, readFileSync } = await import('fs');
  copyFileSync(join(buildDir, 'icon-512.png'), join(buildDir, 'icon.png'));
  console.log('Copied icon.png (512x512)');

  // Generate ICO for Windows (multi-size ICO format)
  const icoSizes = [256, 128, 64, 32, 16];
  const pngBuffers = icoSizes.map((s) => readFileSync(join(buildDir, `icon-${s}.png`)));
  const icoBuffer = createIco(pngBuffers, icoSizes);
  writeFileSync(join(buildDir, 'icon.ico'), icoBuffer);
  console.log('Generated icon.ico');

  await browser.close();
  console.log('Done! Icons saved to build/');
}

generateIcons().catch(console.error);
