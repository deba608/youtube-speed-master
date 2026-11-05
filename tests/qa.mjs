/**
 * P4 QA — loads the unpacked extension into Playwright's Chromium and drives a
 * YouTube-shaped fixture served from https://www.youtube.com:<port>.
 *
 * The fixture origin is real youtube.com (DNS-mapped to 127.0.0.1, self-signed TLS)
 * so the manifest's content_scripts match rule actually fires.
 *
 * Run: npm run qa
 */
import { chromium } from 'playwright';
import { createServer } from 'node:https';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = readFileSync(path.join(ROOT, 'tests/fixtures/page.html'), 'utf8');

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
};

const pems = await selfsigned.generate([{ name: 'commonName', value: 'www.youtube.com' }], {
  keyType: 'rsa',
  keySize: 2048,
  algorithm: 'sha256',
  notAfterDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
});

const server = createServer({ key: pems.private, cert: pems.cert }, (request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204);
    response.end();
    return;
  }
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(FIXTURE);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const origin = `https://www.youtube.com:${port}`;

const profileDir = mkdtempSync(path.join(tmpdir(), 'ytsm-qa-'));
let context;

const waitForRate = async (page, expected, timeout = 2500) => {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeout) {
    last = await page
      .evaluate(() => {
        const video = document.querySelector('video');
        return video ? video.playbackRate : null;
      })
      .catch(() => null);
    if (last !== null && Math.abs(last - expected) < 0.001) return true;
    await page.waitForTimeout(50);
  }
  return last;
};

const bridge = (page, detail) =>
  page.evaluate(
    (value) => document.dispatchEvent(new CustomEvent('ytsm', { detail: value })),
    detail
  );

const readRate = (page) =>
  page.evaluate(() => {
    const video = document.querySelector('video');
    return video ? video.playbackRate : null;
  });

async function openTab(urlPath) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto(origin + urlPath, { waitUntil: 'load', timeout: 15000 });
  await page.waitForSelector('#ytsm-root', { state: 'attached', timeout: 8000 });
  return { page, pageErrors };
}

try {
  context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: true,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${ROOT}`,
      `--load-extension=${ROOT}`,
      '--host-resolver-rules=MAP www.youtube.com 127.0.0.1',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  // --- normal watch page -------------------------------------------------------
  const { page: tab1, pageErrors } = await openTab('/watch?v=qa1');
  check('content script injects overlay', true);
  check('no page errors on load', pageErrors.length === 0, pageErrors);

  await bridge(tab1, '1');
  check('UI pill starts at 1.00x', (await tab1.textContent('#ytsm-root .ytsm-toggle')) === '1.00x');

  await bridge(tab1, '3');
  check('3x applied to video', (await waitForRate(tab1, 3)) === true, await readRate(tab1));

  await tab1.evaluate(() => window.__fixture.setRate(2));
  await tab1.waitForTimeout(150);
  check('re-forces after page sets 2x', (await waitForRate(tab1, 3, 1200)) === true, await readRate(tab1));

  // --- panel + slider ----------------------------------------------------------
  await tab1.click('#ytsm-root .ytsm-toggle');
  await tab1.waitForTimeout(250);
  const panelState = await tab1.evaluate(() => {
    const root = document.querySelector('#ytsm-root');
    const panel = root.querySelector('.ytsm-panel');
    const style = getComputedStyle(panel);
    return {
      open: root.dataset.open,
      expanded: root.querySelector('.ytsm-toggle').getAttribute('aria-expanded'),
      visible: style.visibility === 'visible' && Number(style.opacity) > 0.9,
    };
  });
  check(
    'panel opens (visible + aria-expanded)',
    panelState.open === 'true' && panelState.expanded === 'true' && panelState.visible,
    panelState
  );

  await tab1.evaluate(() => {
    const slider = document.querySelector('#ytsm-root .ytsm-slider');
    slider.value = '2.4';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  check('slider sets 2.4x', (await waitForRate(tab1, 2.4)) === true, await readRate(tab1));
  check(
    'pill label tracks 2.40x',
    (await tab1.textContent('#ytsm-root .ytsm-toggle')) === '2.40x'
  );

  await tab1.keyboard.press('Escape');
  await tab1.waitForTimeout(100);
  check(
    'Escape closes panel',
    (await tab1.getAttribute('#ytsm-root', 'data-open')) === 'false'
  );

  // --- hotkeys -----------------------------------------------------------------
  await tab1.keyboard.press('Shift+.');
  await tab1.waitForTimeout(150);
  check('Shift+. steps to 2.65x', (await waitForRate(tab1, 2.65, 1200)) === true, await readRate(tab1));

  await tab1.keyboard.press('Shift+,');
  await tab1.waitForTimeout(150);
  check('Shift+, steps back to 2.40x', (await waitForRate(tab1, 2.4, 1200)) === true, await readRate(tab1));

  // --- ads ---------------------------------------------------------------------
  await tab1.evaluate(() => window.__fixture.addAd());
  check('ad plays at 1x', (await waitForRate(tab1, 1, 2000)) === true, await readRate(tab1));
  check(
    'ad badge visible',
    await tab1.evaluate(() => document.querySelector('#ytsm-root .ytsm-ad').hidden === false)
  );

  await tab1.evaluate(() => window.__fixture.removeAd());
  check('speed returns after ad', (await waitForRate(tab1, 2.4, 2500)) === true, await readRate(tab1));

  // --- video element replaced + SPA navigation --------------------------------
  await tab1.evaluate(() => {
    window.__fixture.replaceVideo();
    window.__fixture.spaNavigate();
  });
  check(
    'replaced video element gets speed',
    (await waitForRate(tab1, 2.4, 2500)) === true,
    await readRate(tab1)
  );

  // --- pitch -------------------------------------------------------------------
  await bridge(tab1, 'pitch off');
  await tab1.waitForTimeout(150);
  check(
    'pitch can be disabled',
    (await tab1.evaluate(() => document.querySelector('video').preservesPitch)) === false
  );
  await bridge(tab1, 'pitch on');

  // --- persistence across reload ----------------------------------------------
  await bridge(tab1, '3.25');
  await tab1.waitForTimeout(700); // storage write is debounced 250ms
  await tab1.reload({ waitUntil: 'load' });
  await tab1.waitForSelector('#ytsm-root', { state: 'attached', timeout: 8000 });
  check('stored default survives reload', (await waitForRate(tab1, 3.25, 3000)) === true, await readRate(tab1));
  check(
    'UI shows restored 3.25x',
    (await tab1.textContent('#ytsm-root .ytsm-toggle')) === '3.25x'
  );

  // --- second tab + live sync --------------------------------------------------
  const { page: tab2 } = await openTab('/embed/qa2');
  check('embed page gets stored speed', (await waitForRate(tab2, 3.25, 3000)) === true, await readRate(tab2));

  await bridge(tab1, '1.75');
  check('change syncs to second tab', (await waitForRate(tab2, 1.75, 2500)) === true, await readRate(tab2));

  await bridge(tab2, 'reset');
  check('reset syncs back to first tab', (await waitForRate(tab1, 1, 2500)) === true, await readRate(tab1));

  // --- Shorts-shaped URL -------------------------------------------------------
  await tab2.goto(origin + '/shorts/qa3', { waitUntil: 'load' });
  await tab2.waitForSelector('#ytsm-root', { state: 'attached', timeout: 8000 });
  await bridge(tab2, '2.75');
  check('shorts-shaped page applies speed', (await waitForRate(tab2, 2.75, 2000)) === true, await readRate(tab2));

  // --- cleanup state -----------------------------------------------------------
  await bridge(tab2, 'reset');
  check('final reset returns 1x', (await waitForRate(tab2, 1, 2000)) === true, await readRate(tab2));

  // --- optional: real youtube.com smoke ---------------------------------------
  if (process.env.QA_REAL === '1') {
    const realProfile = mkdtempSync(path.join(tmpdir(), 'ytsm-real-'));
    let realContext;
    try {
      realContext = await chromium.launchPersistentContext(realProfile, {
        channel: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 800 },
        args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`],
      });
      const real = await realContext.newPage();
      await real.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await real.waitForSelector('#ytsm-root', { timeout: 30000 });
      check('real YouTube: overlay injected', true);

      await real.waitForSelector('video', { timeout: 30000 });
      // Do not fight a preroll ad: wait until the player is ad-free.
      await real
        .waitForFunction(
          () => !document.querySelector('#movie_player.ad-showing'),
          null,
          { timeout: 20000 }
        )
        .catch(() => {});

      await bridge(real, '3');
      check('real YouTube: 3x applied', (await waitForRate(real, 3, 6000)) === true, await readRate(real));

      await bridge(real, 'reset');
      check('real YouTube: reset to 1x', (await waitForRate(real, 1, 4000)) === true, await readRate(real));
    } catch (error) {
      check(
        'real YouTube smoke (ads/consent/network can make this flaky)',
        false,
        String(error && error.message ? error.message : error).split('\n')[0]
      );
    } finally {
      if (realContext) await realContext.close().catch(() => {});
      try {
        rmSync(realProfile, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
} catch (error) {
  check('QA run completed without exceptions', false, String(error && error.stack ? error.stack : error));
} finally {
  if (context) await context.close().catch(() => {});
  server.close();
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    /* profile may still be locked for a moment; harmless */
  }
}

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  const suffix = result.detail === undefined ? '' : ` ${JSON.stringify(result.detail)}`;
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${suffix}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length > 0) {
  process.exitCode = 1;
}
