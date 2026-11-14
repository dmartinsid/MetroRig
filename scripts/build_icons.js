// Renders public/icons/icon.svg to the app icons through the system Chrome: run `node scripts/build_icons.js` after changing the SVG
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const icons = path.resolve(__dirname, '../public/icons');
const svg = fs.readFileSync(path.join(icons, 'icon.svg'), 'utf8');

// `scale` shrinks the mark onto a full-bleed background: a maskable icon keeps it inside the central 80% circle
const OUTPUTS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.8 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
try {
  for (const { file, size, scale } of OUTPUTS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const inner = Math.round(size * scale);
    await page.setContent(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:#080810;display:grid;place-items:center">
      <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${inner}" height="${inner}" style="display:block">
    </body></html>`);
    await page.waitForFunction(() => document.images[0].complete);
    await page.screenshot({ path: path.join(icons, file), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(`Wrote public/icons/${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
