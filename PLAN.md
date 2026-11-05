# YouTube Speed Master — Project Plan

Chrome extension (Manifest V3) that unlocks YouTube playback speed beyond the built-in 2x cap.

---

## 1. Problem & Solution

YouTube's UI only offers 0.25x – 2x. The underlying HTML5 `<video>` element actually accepts
`playbackRate` from `0.0625` to `16` in Chromium. This extension sets that property directly,
adds a proper UI, and keeps the speed applied across navigation, ads and new videos.

**Core one-liner:**
```js
const v = document.querySelector('video');
v.preservesPitch = true;   // keep audio natural
v.playbackRate = 3;        // override the 2x cap
```

### Technical gotchas to handle
| Gotcha | Handling |
|---|---|
| YouTube resets rate on new video | Re-apply on `loadedmetadata`, `loadeddata` |
| SPA navigation (`/watch?v=...`) doesn't reload page | Listen `yt-navigate-finish`, `yt-page-data-updated` |
| YouTube player sets its own rate | Listen `ratechange`, re-force stored value (guard against infinite loop) |
| Video element is re-created | `MutationObserver` on document, or poll `document.querySelector('video')` |
| Pitch sounds chipmunky | `preservesPitch = true` |
| Ads | Leave ads at 1x (safer, avoids policy complaints) |
| >4x stutter | Cap UI default at 4x, allow 16x via "advanced" toggle |

---

## 2. Feature Scope

### MVP (v1.0) — ship this
- [ ] Floating overlay panel inside the YouTube player
- [ ] Slider: 0.25x – 4x, step 0.05
- [ ] Preset buttons: 0.5 / 0.75 / 1 / 1.25 / 1.5 / 1.75 / 2 / 2.5 / 3 / 3.5 / 4
- [ ] `Shift + .` / `Shift + ,` → step ±0.25 (beats native 2x limit)
- [ ] Popup: set global default speed
- [ ] Persist with `chrome.storage.sync`
- [ ] Auto-apply on every new video, survive SPA navigation
- [ ] Pitch preservation on/off
- [ ] Show current speed on the panel

### v1.1 — polish
- [ ] Per-video speed memory (keyed by video ID)
- [ ] Per-channel default speed
- [ ] "Reset to 1x" hotkey (`Shift + 0`)
- [ ] Enable/disable toggle per tab
- [ ] Dark/light theme follow YouTube

### v1.2 — nice-to-have (optional, NOT for first store release)
- [ ] Custom speed input (up to 16x)
- [ ] Speed profile presets ("Lecture 1.8x", "Podcast 1.5x")
- [ ] Skip-silence via Web Audio (heavy, risky — separate version)
- [ ] Keyboard shortcut remapping

### Explicitly out of scope for v1
- No analytics / tracking (avoids privacy policy complexity)
- No remote code (Chrome Web Store hard rule for MV3)
- No `tabs` / `history` / broad host permissions
- No Firefox/Edge port until v1 is approved

---

## 3. Architecture & File Tree

```
YouTube-Speed-Master/
├── manifest.json          # MV3 manifest
├── src/
│   ├── content.js         # rate engine + overlay UI injection
│   ├── overlay.css        # floating panel styles
│   ├── popup.html         # settings popup
│   ├── popup.js
│   └── popup.css
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── store/
│   ├── screenshot-1.png   # 1280x800
│   ├── screenshot-2.png
│   ├── screenshot-3.png
│   ├── promo-440x280.png
│   └── LISTING.md         # store copy
├── PRIVACY.md             # required for store listing
├── README.md
└── PLAN.md
```

### manifest.json (target shape)
```json
{
  "manifest_version": 3,
  "name": "YouTube Speed Master",
  "version": "1.0.0",
  "description": "Unlock YouTube playback speed beyond 2x — up to 4x with one click, 16x custom.",
  "permissions": ["storage"],
  "action": { "default_popup": "src/popup.html" },
  "icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
  "content_scripts": [
    {
      "matches": ["*://*.youtube.com/*"],
      "js": ["src/content.js"],
      "css": ["src/overlay.css"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ]
}
```

### Rate engine sketch
```js
let desired = 1;
let applying = false; // loop guard

function apply() {
  const v = document.querySelector('video');
  if (!v) return;
  v.preservesPitch = true;
  if (Math.abs(v.playbackRate - desired) > 0.001) {
    applying = true;
    v.playbackRate = desired;
    requestAnimationFrame(() => (applying = false));
  }
}

// YouTube fights back → re-force
document.addEventListener('ratechange', (e) => {
  if (e.target.tagName === 'VIDEO' && !applying) {
    if (Math.abs(e.target.playbackRate - desired) > 0.001) {
      applying = true; e.target.playbackRate = desired;
      requestAnimationFrame(() => (applying = false));
    }
  }
}, true);

// SPA nav
document.addEventListener('yt-navigate-finish', () => setTimeout(apply, 300));
document.addEventListener('yt-page-data-updated', () => setTimeout(apply, 300));
new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
```

---

## 4. Milestones

| Phase | Work | Deliverable |
|---|---|---|
| **P0 — Scaffold** | Folder, manifest, icons, blank content script | Loads as unpacked extension |
| **P1 — Engine** | playbackRate control + SPA handling + pitch | Works via console test |
| **P2 — UI** | Overlay panel + slider + presets + shortcuts | Usable daily driver |
| **P3 — Settings** | Popup + storage + defaults | Persists across restart |
| **P4 — QA** | Test: normal video, live stream, Shorts, playlist, ads, embed, SPA nav, 2 tabs, incognito | Bug list = 0 |
| **P5 — Store prep** | Listing copy, screenshots, privacy policy, package zip | Ready to submit |
| **P6 — Publish** | Dev account, upload, fill listing, submit, respond to review | Live |

---

## 5. Build & Test (local)

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. **Load unpacked** → select `YouTube-Speed-Master/`
4. Open `https://youtube.com/watch?v=...` → verify overlay + speed applies
5. After each code change: click the reload icon on the extension card, refresh YouTube tab

Package for upload (zip *contents*, not the parent folder):
```powershell
Compress-Archive -Path .\manifest.json, .\src, .\icons -DestinationPath .\dist\youtube-speed-master-1.0.0.zip
```

---

## 6. Publishing — Chrome Web Store Checklist

### Account
- [ ] Register at https://chrome.google.com/webstore/devconsole — **one-time $5 USD fee**
- [ ] Verify developer email
- [ ] Complete publisher profile (name, contact)

### Required assets
- [ ] Extension ZIP (manifest.json at zip root)
- [ ] Store icon **128x128 PNG**
- [ ] At least **1 screenshot, 1280x800** (up to 5)
- [ ] Small promo tile **440x280 PNG** (optional but recommended)
- [ ] **Privacy policy URL** — required because extension stores settings.
      Host `PRIVACY.md` on GitHub Pages / gist / personal site
- [ ] Single purpose description (1 sentence)
- [ ] Permission justification:
      - `storage` → "Save user's preferred playback speed locally"
      - content script on `youtube.com` → "Set HTML5 video playbackRate on YouTube pages"
- [ ] Data usage disclosure: **collects no user data**
- [ ] Category: Productivity / Tools
- [ ] Language, region visibility

### Store listing draft
- **Name:** YouTube Speed Master
- **Short description (≤132 chars):**
  `Play YouTube up to 4x (16x custom) with one click. Speed presets, hotkeys, auto-apply. No tracking.`
- **Detailed description:** problem → features → privacy → changelog
- **Screenshots:** panel open at 2.5x, popup settings, hotkey overlay

### Review process
- Submit → automated checks → human review, usually **1–3 business days** (new devs sometimes 1–2 weeks)
- Common rejection reasons to pre-empt:
  - Vague purpose → write clear single-purpose text
  - Missing/irrelevant permissions → only request `storage`
  - Remote code → none used; all JS bundled
  - Broken functionality → test on clean Chrome profile first
  - Trademark in name/icon → **avoid YouTube logo, avoid "for YouTube" ambiguity**;
    plain name + neutral icon (a speedometer/gauge, not the YT play button)
- If rejected: fix listed item, bump `version`, resubmit

### After approval
- [ ] Post-launch: monitor reviews, `chrome://extensions` error reports
- [ ] Set up update flow: bump `version` in manifest, re-zip, upload new package
- [ ] Optional: Edge Add-ons store (accepts Chrome MV3 zip with minor manifest tweaks)
- [ ] Optional: Firefox AMO (needs `browser_specific_settings` + `browser.*` API shim)

---

## 7. Risks & Policy Notes

| Risk | Mitigation |
|---|---|
| Name/icon looks like official YouTube product | Neutral branding, no YT logo, disclaimer in description: "Not affiliated with YouTube" |
| Store flags "site-specific" extension as low value | Emphasize unique feature (beyond 2x cap + presets + hotkeys) |
| YouTube changes DOM / player internals | Only depend on `<video>` element — very stable |
| Speed resets after YouTube update | `ratechange` guard + MutationObserver covers most cases |
| 16x causes freeze | Keep 16x behind advanced input, not default UI |
| Privacy policy missing | `PRIVACY.md` states: no data collected, settings stay in `chrome.storage.sync` |

---

## 8. Open Decisions

- [ ] Extension name: **YouTube Speed Master** (alt: *SpeedUp for YouTube*, *Playback Rate Pro*)
- [ ] Default max on slider: **4x** (recommended) vs 16x always visible
- [ ] Show overlay always, or only on hover / keyboard shortcut?
- [ ] Include per-channel memory in v1, or defer to v1.1?
- [ ] Privacy policy host: GitHub Pages vs gist

---

## 9. Next Action

Start **P0**: scaffold `manifest.json`, `src/content.js` stub, and 4 icon files → load unpacked in Chrome.
