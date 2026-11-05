# Speed Master — User Guide

Speed Master is a Chrome extension that unlocks YouTube playback speeds beyond the built-in 2x
cap: **0.25x to 4x** from the UI, with pitch kept natural and ads left at 1x.

- No account, no tracking, no servers.
- Works on `youtube.com` in desktop Chrome, Edge, Brave and other Chromium browsers.
- Requires Manifest V3 support: **Chrome/Edge 88 or newer**.

New to the extension? Follow [Install](#install), then [First run](#first-run). Everything else is
optional reading.

---

## Install

### Option A — Chrome Web Store (recommended)

1. Open the Speed Master listing in the Chrome Web Store.
2. Click **Add to Chrome** → **Add extension**.
3. Pin the icon: click the puzzle-piece button in the toolbar, then the pin next to **Speed
   Master**.
4. Open any YouTube video. A speed pill appears in the bottom-right of the player.

> The listing goes live with the P6 release. Until then use Option B.

### Option B — From a ZIP (no store)

Two ZIPs work; both must be extracted first — Chrome cannot load a `.zip`.

- **Packaged build** (recommended, only runtime files): `dist/youtube-speed-master-1.0.0.zip`
- **Repository source**: GitHub → **Code** → **Download ZIP**

1. Extract the ZIP to a permanent folder, e.g. `C:\Users\Dev\Speed-Master`.
   - The packaged ZIP extracts flat: `manifest.json` sits at the top level.
   - The GitHub ZIP adds a nesting level (`youtube-speed-master-main\youtube-speed-master-main\`),
     so open it and use the inner folder.
2. Open `chrome://extensions` in a new tab.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the folder that **directly contains `manifest.json`** — not its parent.
6. The **Speed Master** card appears. Pin it if you want the popup in the toolbar.
7. Open a YouTube video and check the console on that tab: it should log
   `[Speed Master] ready`.

Keep the extracted folder where it is: Chrome reads it on every launch. After replacing the files
with a newer build, press the reload icon on the extension card, then reload the YouTube tab.

If Chrome says **“Manifest file is missing or unreadable”**, you selected the parent folder — go one
level down to the folder holding `manifest.json`.

### Option C — Microsoft Edge

Edge accepts the same ZIP and the same unpacked folder.

1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** → select the folder with `manifest.json`.

---

## First run

1. Open any `https://www.youtube.com/watch?v=...` page.
2. A small **speed pill** (`1.00x`) sits in the bottom-right of the player, above the native
   controls.
3. Click the pill to open the panel, or press <kbd>Shift</kbd> + <kbd>.</kbd> to speed up without
   opening anything.
4. The speed you pick is saved and applied to every new video from then on.

If the pill does not appear, see [Troubleshooting](#troubleshooting).

---

## Controls

### In the player

| Action | How |
|---|---|
| Open / close the panel | Click the speed pill |
| Change speed | Drag the slider (0.25x–4x, 0.05x steps) |
| Jump to a common speed | Click a preset: 0.5 / 0.75 / 1 / 1.25 / 1.5 / 1.75 / 2 / 2.5 / 3 / 3.5 / 4 |
| Faster by 0.25x | <kbd>Shift</kbd> + <kbd>.</kbd> |
| Slower by 0.25x | <kbd>Shift</kbd> + <kbd>,</kbd> |
| Close the panel | <kbd>Esc</kbd>, or click outside it |
| Natural or chipmunk audio | **Keep pitch** checkbox in the panel |

Hotkeys are ignored while you type in a comment box, search field or the address bar, so they will
not interrupt text entry.

### In the toolbar popup

Click the Speed Master icon to set the **default speed for every video**:

- Slider + presets, same 0.25x–4x range.
- **Reset 1x** returns to normal speed.
- **Keep pitch** sets the audio preference globally.

Changes apply immediately to open YouTube tabs and are remembered across restarts. If you are
signed in to Chrome, they also sync to your other computers through your Chrome profile.

### Ads and fullscreen

- Ads always play at **1x** and the panel shows an `Ad · 1x` badge. When the ad ends, your speed
  comes back automatically.
- The pill and panel stay usable in fullscreen.

---

## Speed limits

| Where | Range |
|---|---|
| Panel, popup, hotkeys | 0.25x – 4x |
| Console API (power users) | 0.0625x – 16x |

The UI deliberately stops at 4x. Beyond that, video and audio quality drop sharply and YouTube's
own player gets unstable. If you know you want it, open DevTools on the YouTube tab, switch the
console context to **Speed Master**, and run:

```js
__ytSpeedMaster.setRate(8);   // 8x
__ytSpeedMaster.setRate(1);   // back to normal
```

The limit resets to the UI range the next time you use the slider or popup.

---

## Settings and sync

Only two values are stored, both in `chrome.storage.sync`:

| Key | Meaning |
|---|---|
| `defaultRate` | Speed applied to new videos (0.25–4) |
| `preservesPitch` | Keep audio natural (`true`) or let it rise (`false`) |

Nothing leaves your browser except Chrome's own profile sync, if you have it enabled. See
[PRIVACY.md](PRIVACY.md).

### Reset everything

1. Click the toolbar icon → **Reset 1x**.
2. To wipe the stored settings completely: `chrome://extensions` → Speed Master → **Remove**, then
   reinstall. Removing the extension clears its storage.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| No speed pill on a video | Reload the tab. Confirm the site is `youtube.com`, not an embedded player on another site. |
| Pill appears but speed snaps back | Another extension is also setting playback rate. Disable the other speed extension and reload. |
| Hotkeys do nothing | Click once inside the page first. Hotkeys are disabled while a text field has focus. |
| Speed is ignored on ads | Expected — ads are forced to 1x on purpose. |
| Audio sounds sped up | Enable **Keep pitch** in the panel or the popup. |
| Panel is hidden behind player controls | Hover the player so the controls fade, or use fullscreen. |
| Settings did not carry to another computer | Chrome sync must be on for the profile; check `chrome://settings/syncSetup`. |
| `[Speed Master] ready` not in console | The extension is disabled or not loaded. Check `chrome://extensions` for errors. |
| `Manifest file is missing or unreadable` | You selected the folder **above** the one with `manifest.json` — GitHub ZIPs extract with an extra nesting level. Select the folder that directly contains `manifest.json`, or extract `dist/youtube-speed-master-<version>.zip` and select that folder. |
| Extension missing after a Chrome update | Chrome disables unpacked extensions occasionally — re-enable it on `chrome://extensions`. |

Still stuck? Open an issue with your Chrome version, the video URL and any console errors:
<https://github.com/deba608/youtube-speed-master/issues>.

---

## Uninstall

1. `chrome://extensions`
2. Find **Speed Master** → **Remove**.
3. Reload YouTube. Playback speed returns to the native 0.25x–2x menu.

Removing the extension also deletes its saved speed and pitch settings.

---

## Privacy

Speed Master collects nothing: no analytics, no telemetry, no accounts, no network requests of its
own. The only stored data is your speed and pitch preference. Full policy:
[PRIVACY.md](PRIVACY.md) · <https://deba608.github.io/youtube-speed-master/privacy.html>

Not affiliated with YouTube or Google. YouTube is a trademark of Google LLC.
