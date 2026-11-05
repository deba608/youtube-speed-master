# YouTube Speed Master

Chrome extension (Manifest V3) that unlocks YouTube playback speed beyond the built-in 2x cap.

> Store name: **Speed Master**. Not affiliated with YouTube or Google.

## Status

**P6 — Publishing.** v1.0.0 is packaged and documented; the only remaining step is the developer
dashboard (account, upload, submit). Walkthrough: [store/PUBLISH.md](store/PUBLISH.md).

Roadmap and design notes: [PLAN.md](PLAN.md).

**New here?** [GUIDE.md](GUIDE.md) covers install, controls, settings and troubleshooting.

## Install

**From the store:** Chrome Web Store → **Add to Chrome** → pin the icon.

**Pre-release / development:** `chrome://extensions` → enable **Developer mode** →
**Load unpacked** → select this folder → open a YouTube video. The console should log
`[Speed Master] ready`.

Full install steps and Edge/Brave notes: [GUIDE.md](GUIDE.md#install).

## Use

- Click the toolbar icon → set a default speed (0.25x–4x), presets, pitch, reset.
- Click the speed pill (bottom-right of the player) to open the panel.
- Drag the slider or hit a preset (0.5x … 4x).
- `Shift + .` → faster by 0.25x, `Shift + ,` → slower by 0.25x.
- `Esc` or a click outside closes the panel.
- Ads always play at 1x; the panel shows an `Ad · 1x` badge.

Speed and pitch are stored in `chrome.storage.sync` — no account, no network calls.
Full user guide: [GUIDE.md](GUIDE.md).

## Load unpacked (dev)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder
4. Visit any `youtube.com/watch?v=...` page
5. DevTools console should log `[Speed Master] ready`

After editing `content.js`: click the reload icon on the extension card, then reload the
YouTube tab.

## Test the engine (console)

In the YouTube tab's DevTools, switch the console context dropdown from `top` to
**YouTube Speed Master**, then:

```js
__ytSpeedMaster.setRate(3);   // 3x
__ytSpeedMaster.info();       // { desired, applied, enabled, preservesPitch, ad, hasVideo }
__ytSpeedMaster.setPitch(false);
__ytSpeedMaster.reset();      // back to 1x
```

From the page context instead (no context switch):

```js
document.dispatchEvent(new CustomEvent('ytsm', { detail: '3' })); // set rate
document.dispatchEvent(new CustomEvent('ytsm', { detail: 'info' }));
document.dispatchEvent(new CustomEvent('ytsm', { detail: 'reset' }));
```

Expected: video keeps the speed across `loadedmetadata`, SPA navigation to another video,
and YouTube trying to reset it. Ads play at 1x.

## QA

```powershell
npm install
npx playwright install chromium   # once
npm run qa                        # 23 automated checks
$env:QA_REAL = '1'; npm run qa    # + real youtube.com smoke test (ads/consent can make it flaky)
```

The automated run loads the real unpacked extension into a headless Chromium and serves a
YouTube-shaped fixture from `https://www.youtube.com:<port>` (DNS-mapped to localhost), so the
manifest match rule, content script, storage and UI are all exercised end to end.

Manual cases that need a human on real YouTube (live, Shorts, playlist, incognito, fullscreen):
[tests/MANUAL-QA.md](tests/MANUAL-QA.md).

## Store package

```powershell
npm run package   # writes dist/youtube-speed-master-1.0.0.zip
```

The ZIP contains `manifest.json`, `src/` and `icons/` only — manifest at the root, no dev files.
The script verifies the required entries and fails if any are missing.

- Listing copy, permission justifications and data disclosures: [store/LISTING.md](store/LISTING.md)
- Dashboard walkthrough (account → upload → submit): [store/PUBLISH.md](store/PUBLISH.md)
- Screenshots + promo tile: `store/`, regenerated with `npm run assets`
- Privacy policy (public): https://deba608.github.io/youtube-speed-master/privacy.html
- Source of the policy page: [docs/privacy.html](docs/privacy.html)

## Layout

```
manifest.json     MV3 manifest
src/content.js    rate engine + overlay panel
src/overlay.css   overlay panel styles
src/popup.*       settings popup
icons/            16 / 32 / 48 / 128 px
scripts/          icon generator, packager, dev harnesses
tests/            Playwright QA + manual checklist
store/            listing copy, screenshots, promo tile
docs/             GitHub Pages site (privacy policy)
GUIDE.md          user guide: install, controls, troubleshooting
```

## Regenerate icons

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\make-icons.ps1
```

## Privacy

No data collected. See [PRIVACY.md](PRIVACY.md).

## License

[MIT](LICENSE)
