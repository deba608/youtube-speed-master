# YouTube Speed Master

Chrome extension (Manifest V3) that unlocks YouTube playback speed beyond the built-in 2x cap.

> Not affiliated with YouTube or Google.

## Status

**P1 — Engine.** `playbackRate` control, pitch preservation, SPA-navigation handling and the
`ratechange` loop guard are implemented. No overlay UI yet (P2), no persisted settings yet (P3).

Roadmap and design notes: [PLAN.md](PLAN.md).

## Load unpacked (dev)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder
4. Visit any `youtube.com/watch?v=...` page
5. DevTools console should log `[YouTube Speed Master] engine ready (P1)`

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
