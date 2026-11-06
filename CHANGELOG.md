# Changelog

All notable changes to Speed Master are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — 2026-11-06

### Added

- **Panel appearance** — options page with size (80–140%), transparency (40–100%), bottom-left or
  bottom-right placement and optional auto-hide. Changes apply to open tabs without a reload.
- **Live preview** on the options page showing the current size, transparency and position.
- **Keyboard preferences** — enable/disable shortcuts and choose a 0.05x–0.50x step size.
- **More shortcuts** — `Shift` + `0` resets to 1x; `Shift` + `1`…`4` jumps to 1x–4x.
- **Accessibility** — polite live-region announcements for speed changes, focus returns to the pill
  when the panel closes with `Esc`, and a settings button in the popup header.
- **Shorts placement** — the panel is raised on `/shorts/` pages so it clears the action rail.

### Changed

- Settings page is registered through the manifest's `options_ui`; the popup gear button opens it.
- Export/import and **Reset all** now include the appearance and hotkey settings.
- The panel hint shows the active step size, or “Hotkeys off” when shortcuts are disabled.

## [1.1.0] — 2026-11-06

### Added

- **Per-channel speed memory** — opt-in “Remember this channel” in the player panel. Saved rates
  apply automatically on that channel and take precedence over the global default. Managed from
  the popup (list, remove, clear all), stored in `chrome.storage.local`, capped at 500 channels.
- **Custom presets** — add or remove preset speeds (3–12 entries, 0.25x–4x). The player panel
  updates live; **Defaults** restores the original eleven.
- **Export / import** — one JSON file with speed, pitch, presets and channel memory.
- **Reset all** — clears the global default, pitch, presets and channel memory in one click.
- Popup sections for presets, remembered channels and settings actions.
- Read-only state mirror on `#ytsm-root` (`data-channel`, `data-remembered`, `data-presets`,
  `data-extension-id`) used by QA and manual debugging.

### Changed

- Storage now uses `presets` in `chrome.storage.sync` and `channelRates` in
  `chrome.storage.local`; settings without these keys fall back to defaults.
- Changing the global default no longer overrides a channel that has its own saved rate.

### Fixed

- Ad detection also recognises `.ytp-ad-player-overlay`, so overlay-only ads stay at 1x.
- Speed is re-asserted once when an ad hands playback back, avoiding a stuck 1x video.
- Rate persistence no longer races between tabs when a channel rate and the global default change
  at the same time.

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

[1.2.0]: https://github.com/deba608/youtube-speed-master/releases/tag/v1.2.0
[1.1.0]: https://github.com/deba608/youtube-speed-master/releases/tag/v1.1.0
[1.0.0]: https://github.com/deba608/youtube-speed-master/releases/tag/v1.0.0
