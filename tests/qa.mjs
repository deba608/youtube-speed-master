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

  // --- 1.1: ad overlay detection ----------------------------------------------
  await tab1.waitForTimeout(700); // let any in-flight storage sync settle
  await bridge(tab1, '2.4');
  await waitForRate(tab1, 2.4, 1500);
  await tab1.waitForTimeout(500);
  await tab1.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.className = 'ytp-ad-player-overlay';
    overlay.id = 'qa-ad-overlay';
    document.getElementById('movie_player').appendChild(overlay);
  });
  check('overlay-only ad keeps 1x', (await waitForRate(tab1, 1, 2500)) === true, await readRate(tab1));
  await tab1.evaluate(() => document.getElementById('qa-ad-overlay')?.remove());
  check('speed returns after overlay ad', (await waitForRate(tab1, 2.4, 2500)) === true, await readRate(tab1));

  // --- 1.1: per-channel memory -------------------------------------------------
  const extensionId = await tab1.getAttribute('#ytsm-root', 'data-extension-id');
  check(
    'extension id available for popup tests',
    typeof extensionId === 'string' && extensionId.length > 10,
    extensionId
  );

  check(
    'channel detected on watch page',
    (await tab1.getAttribute('#ytsm-root', 'data-channel')) === '/@qa-channel'
  );

  await tab1.click('#ytsm-root .ytsm-toggle');
  await tab1.waitForTimeout(200);
  check(
    'remember row visible on a channel page',
    await tab1.evaluate(() => !document.querySelector('#ytsm-root .ytsm-remember').hidden)
  );
  await tab1.click('#ytsm-root .ytsm-remember input');
  await tab1.waitForTimeout(500);
  check(
    'remember channel saves the current rate',
    (await tab1.getAttribute('#ytsm-root', 'data-remembered')) === 'true'
  );
  await tab1.keyboard.press('Escape');

  // --- 1.1: popup (presets, channels, export/import/reset) ---------------------
  const popup = await context.newPage();
  const popupErrors = [];
  popup.on('pageerror', (error) => popupErrors.push(String(error)));
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html`, { waitUntil: 'load' });
  await popup.waitForSelector('#presets .preset', { timeout: 8000 });
  check('popup loads without errors', popupErrors.length === 0, popupErrors);
  check(
    'popup shows the 11 default presets',
    (await popup.$$('#presets .preset')).length === 11
  );
  check(
    'popup lists the remembered channel',
    (await popup.$$('.channel-row')).length === 1 &&
      (await popup.textContent('.channel-rate')) === '2.40x'
  );

  // Changing the global default must not override a remembered channel.
  await popup.evaluate(() => {
    const speed = document.getElementById('speed');
    speed.value = '1';
    speed.dispatchEvent(new Event('input', { bubbles: true }));
    speed.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await popup.waitForTimeout(500);
  check(
    'global default change leaves the remembered channel alone',
    (await tab1.textContent('#ytsm-root .ytsm-toggle')) === '2.40x'
  );

  await tab1.evaluate(() => window.__fixture.setChannel('@qa-other'));
  await tab1.waitForTimeout(400);
  check(
    'other channel falls back to global default',
    (await waitForRate(tab1, 1, 2500)) === true,
    await readRate(tab1)
  );

  await tab1.evaluate(() => window.__fixture.setChannel('@qa-channel'));
  await tab1.waitForTimeout(400);
  check(
    'remembered channel restores 2.4x',
    (await waitForRate(tab1, 2.4, 2500)) === true,
    await readRate(tab1)
  );

  await popup.click('.channel-remove');
  await popup.waitForTimeout(500);
  check(
    'popup forgets a channel',
    (await tab1.getAttribute('#ytsm-root', 'data-remembered')) === 'false'
  );
  check(
    'rate falls back after forgetting',
    (await waitForRate(tab1, 1, 2500)) === true,
    await readRate(tab1)
  );

  await popup.fill('#preset-input', '1.15');
  await popup.click('#preset-form button[type="submit"]');
  await popup.waitForTimeout(500);
  check(
    'custom preset reaches the player panel',
    (await tab1.$$('#ytsm-root .ytsm-preset')).length === 12 &&
      (await tab1.getAttribute('#ytsm-root', 'data-presets')).includes('1.15')
  );

  await popup.click('#preset-defaults');
  await popup.waitForTimeout(500);
  check(
    'presets restore to defaults',
    (await tab1.$$('#ytsm-root .ytsm-preset')).length === 11
  );

  const downloadPromise = popup.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await popup.click('#export-settings');
  const download = await downloadPromise;
  let exported = null;
  if (download) {
    try {
      exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
    } catch (error) {
      exported = null;
    }
  }
  check(
    'export downloads a settings JSON',
    exported?.app === 'speed-master' &&
      exported?.schema === 1 &&
      Array.isArray(exported?.settings?.presets)
  );

  const importPayload = {
    app: 'speed-master',
    schema: 1,
    settings: { defaultRate: 3.3, preservesPitch: false, presets: [1, 1.5, 2, 3, 4] },
    channels: {},
  };
  await popup.setInputFiles('#import-file', {
    name: 'settings.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importPayload)),
  });
  await popup.waitForTimeout(700);
  check(
    'import applies the default speed',
    (await waitForRate(tab1, 3.3, 3000)) === true,
    await readRate(tab1)
  );
  check(
    'import applies presets and pitch',
    (await tab1.$$('#ytsm-root .ytsm-preset')).length === 5 &&
      (await tab1.evaluate(() => document.querySelector('video').preservesPitch)) === false
  );

  await popup.click('#reset-all');
  await popup.waitForTimeout(700);
  check(
    'reset all returns to 1x with pitch on',
    (await waitForRate(tab1, 1, 3000)) === true &&
      (await tab1.evaluate(() => document.querySelector('video').preservesPitch)) === true,
    await readRate(tab1)
  );

  await popup.close();

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
