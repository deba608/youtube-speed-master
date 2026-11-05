# YouTube Speed Master

Chrome extension (Manifest V3) that unlocks YouTube playback speed beyond the built-in 2x cap.

> Not affiliated with YouTube or Google.

## Status

**P3 — Settings.** Popup sets the global default speed and pitch preference; both persist in
`chrome.storage.sync`, survive restarts and sync across Chrome profiles. In-page changes (slider,
presets, hotkeys) update the saved default too.

Roadmap and design notes: [PLAN.md](PLAN.md).

## Use

- Click the toolbar icon → set a default speed (0.25x–4x), presets, pitch, reset.
- Click the speed pill (bottom-right of the player) to open the panel.
- Drag the slider or hit a preset (0.5x … 4x).
- `Shift + .` → faster by 0.25x, `Shift + ,` → slower by 0.25x.
- `Esc` or a click outside closes the panel.
- Ads always play at 1x; the panel shows an `Ad · 1x` badge.

Speed and pitch are stored in `chrome.storage.sync` — no account, no network calls.

## Load unpacked (dev)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder
4. Visit any `youtube.com/watch?v=...` page
5. DevTools console should log `[YouTube Speed Master] ready (P3)`

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

## Layout

```
manifest.json     MV3 manifest
src/content.js    rate engine (P1) + overlay (P2)
src/overlay.css   overlay panel styles (P2)
src/popup.*       settings popup (P3)
icons/            16 / 32 / 48 / 128 px
scripts/          icon generator + dev engine harness
```

## Regenerate icons

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\make-icons.ps1
```

## Privacy

No data collected. See [PRIVACY.md](PRIVACY.md).

## License

[MIT](LICENSE)
