# Chrome Web Store listing — Speed Master

Store copy and metadata for YouTube Speed Master v1.0.0.
Replace `[PRIVACY_URL]` once GitHub Pages is live.

---

## Identity

- **Name:** Speed Master
- **Version:** 1.0.0
- **Category:** Productivity
- **Language:** English
- **Visibility:** Public, all regions
- **Homepage:** https://github.com/deba608/youtube-speed-master
- **Support / issue tracker:** https://github.com/deba608/youtube-speed-master/issues
- **Privacy policy URL:** https://deba608.github.io/youtube-speed-master/privacy.html

## Short description (≤132 characters)

```
Play YouTube up to 4x with preset speeds, a slider and hotkeys. Pitch stays natural. No tracking.
```

(97 characters)

## Detailed description

```
Speed Master unlocks playback speeds beyond YouTube's built-in 2x cap.

WATCH FASTER
• Slider from 0.25x to 4x in 0.05x steps
• 11 one-click presets: 0.5 / 0.75 / 1 / 1.25 / 1.5 / 1.75 / 2 / 2.5 / 3 / 3.5 / 4
• Shift + . and Shift + , step the speed by 0.25x without touching the mouse
• The speed applies to every new video, survives in-page navigation, and re-applies if the player resets it

SOUND STAYS NATURAL
• Pitch preservation is on by default, toggleable from the panel or the popup

SET IT ONCE
• Choose a default speed in the toolbar popup
• Saved with chrome.storage.sync, so it follows your Chrome profile and survives restarts
• Per-page changes (slider, presets, hotkeys) also become the saved default

KEEPS OUT OF THE WAY
• Compact speed pill in the player; open the full panel only when you need it
• Ads always play at 1x
• Works in fullscreen

PRIVACY
• No analytics, no telemetry, no accounts, no servers
• The only stored data is your speed and pitch preference
• No remote code; everything ships inside the extension

Note: playback rates above 4x are available through the console API for power users, but the
store UI stays within 0.25x–4x.

Not affiliated with YouTube or Google. YouTube is a trademark of Google LLC.

CHANGELOG
1.0.0 — first release: overlay panel, slider, presets, hotkeys, popup defaults, sync storage,
ads at 1x, pitch preservation.
```

## Single purpose

Sets the HTML5 video playback rate on YouTube pages so viewers can watch faster or slower than
the built-in 2x limit.

## Permission justification

| Permission | Justification |
|---|---|
| `storage` | Save the user's preferred playback speed and pitch setting locally and sync them through their Chrome profile. |
| Content script on `*://*.youtube.com/*` | Set the `<video>` element's `playbackRate` and show the speed panel on YouTube pages. No page data is read or transmitted. |

No host permissions beyond `youtube.com`. No `tabs`, `history`, `scripting` or `webRequest`.

## Data usage disclosure

- Does the extension collect user data? **No**
- Does it use data for purposes unrelated to its single purpose? **No**
- Does it sell data to third parties? **No**
- Does it use or transfer data for determining creditworthiness? **No**
- Certify: does not collect personally identifiable information, health, financial, authentication,
  personal communications, location, web history, user activity, or website content.

## Assets

| Asset | File | Status |
|---|---|---|
| Extension ZIP | `dist/youtube-speed-master-1.0.0.zip` | built by `npm run package` |
| Store icon 128x128 | `icons/icon128.png` | done |
| Screenshot 1 (1280x800) | `store/screenshot-1.png` | panel open at 2.5x |
| Screenshot 2 (1280x800) | `store/screenshot-2.png` | popup settings |
| Screenshot 3 (1280x800) | `store/screenshot-3.png` | hotkeys |
| Small promo tile 440x280 | `store/promo-440x280.png` | done |

Screenshot captions (optional in the dashboard):

1. Watch up to 4x — slider, presets and a live speed readout
2. Set your default once — synced through Chrome
3. Keyboard-first — Shift + . / Shift + , to step speed

## Review notes to pre-empt rejection

- Purpose is narrow and stated in the first line of the description.
- Only `storage` permission plus a content script on youtube.com.
- No remote code (MV3, all JS bundled).
- Branding uses a neutral speedometer icon and the generic name "Speed Master" — no YouTube
  logo, play button or "official" wording.
- Ads are deliberately left at 1x.
- Tested on Chrome 156 (unpacked) and via Playwright; see `tests/`.

## After approval

- Bump `version` in `manifest.json`, run `npm run package`, upload the new ZIP.
- Optional: Edge Add-ons listing (accepts Chrome MV3 ZIP), Firefox AMO needs a `browser.*` shim.
