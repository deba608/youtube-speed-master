# YouTube Speed Master

Chrome extension (Manifest V3) that unlocks YouTube playback speed beyond the built-in 2x cap.

> Not affiliated with YouTube or Google.

## Status

**P0 — Scaffold.** Manifest, content-script stub and icons are in place. Not yet functional.

Roadmap and design notes: [PLAN.md](PLAN.md).

## Load unpacked (dev)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder
4. Visit any `youtube.com/watch?v=...` page
5. DevTools console should log `[YouTube Speed Master] content script loaded (P0 stub)`

## Layout

```
manifest.json     MV3 manifest
src/content.js    rate engine + overlay (P1 / P2)
src/overlay.css   overlay panel styles (P2)
src/popup.*       settings popup (P3)
icons/            16 / 32 / 48 / 128 px
scripts/          icon generator
```

## Regenerate icons

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\make-icons.ps1
```

## Privacy

No data collected. See [PRIVACY.md](PRIVACY.md).

## License

[MIT](LICENSE)
