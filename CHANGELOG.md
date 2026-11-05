# Changelog

All notable changes to Speed Master are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-11-06

First public release.

### Added

- Playback speed from **0.25x to 4x** in 0.05x steps via an in-player slider.
- 11 presets: 0.5 / 0.75 / 1 / 1.25 / 1.5 / 1.75 / 2 / 2.5 / 3 / 3.5 / 4.
- Compact speed pill in the player; full panel opens on click.
- Hotkeys: `Shift + .` faster by 0.25x, `Shift + ,` slower by 0.25x, `Esc` closes the panel.
- Toolbar popup for the global default speed and pitch preference.
- Settings persisted in `chrome.storage.sync`; changes apply live to open tabs.
- In-page changes (slider, presets, hotkeys) update the saved default.
- Pitch preservation on by default, toggleable in the panel or popup.
- Ads forced to 1x with an `Ad · 1x` badge; speed restores after the ad.
- Speed re-applies after `loadedmetadata`, SPA navigation and YouTube rate resets.
- Fullscreen support.
- Power-user console API: `__ytSpeedMaster.setRate(rate)` up to 16x.
- Store assets: listing copy, 3 x 1280x800 screenshots, 440x280 promo tile.
- Privacy policy published at <https://deba608.github.io/youtube-speed-master/privacy.html>.
- Playwright QA suite (23 checks, plus an optional real-YouTube smoke test).
- Packaging script producing a forward-slash ZIP with `manifest.json` at the root.

### Security

- MV3, `storage` permission only, content script limited to `*://*.youtube.com/*`.
- No remote code, no analytics, no telemetry, no network requests.

### Known limitations

- Embedded third-party players are out of scope (`all_frames: false`).
- UI intentionally caps at 4x; higher rates are console-only.
- Firefox requires a `browser.*` shim and is not supported yet.

[1.0.0]: https://github.com/deba608/youtube-speed-master/releases/tag/v1.0.0
