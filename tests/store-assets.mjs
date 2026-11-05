/**
 * Renders the Chrome Web Store screenshots + promo tile from store/assets/stage.html.
 * Output: store/screenshot-1.png (1280x800), screenshot-2, screenshot-3, promo-440x280.png
 *
 * Run: npm run assets
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = pathToFileURL(path.join(ROOT, 'store/assets/stage.html')).href;
const OUT = path.join(ROOT, 'store');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

const render = async (shot, file, width, height) => {
  await page.setViewportSize({ width, height });
  await page.goto(`${STAGE}?shot=${shot}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350); // let the panel transition settle
  const target = path.join(OUT, file);
  await page.screenshot({ path: target });
  console.log(`wrote ${path.relative(ROOT, target)}`);
};

await render('1', 'screenshot-1.png', 1280, 800);
await render('2', 'screenshot-2.png', 1280, 800);
await render('3', 'screenshot-3.png', 1280, 800);
await render('promo', 'promo-440x280.png', 440, 280);

await browser.close();
