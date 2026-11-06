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

### Option A — From the release ZIP (recommended)

Two ZIPs work; both must be extracted first — Chrome cannot load a `.zip`.

- **Packaged build** (recommended, only runtime files):
  [`youtube-speed-master-1.2.0.zip`](https://github.com/deba608/youtube-speed-master/releases/latest/download/youtube-speed-master-1.2.0.zip)
  — or run `npm run package` in a clone to produce `dist/youtube-speed-master-1.2.0.zip`
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

The Chrome Web Store listing is deferred for now. GitHub releases are the only distribution
channel, so there is no $5 developer fee.

### Option B — Microsoft Edge

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
| Faster by one step | <kbd>Shift</kbd> + <kbd>.</kbd> (0.25x by default) |
| Slower by one step | <kbd>Shift</kbd> + <kbd>,</kbd> |
| Back to 1x | <kbd>Shift</kbd> + <kbd>0</kbd> |
| Jump to 1x / 2x / 3x / 4x | <kbd>Shift</kbd> + <kbd>1</kbd> … <kbd>4</kbd> |
| Close the panel | <kbd>Esc</kbd>, or click outside it |
| Natural or chipmunk audio | **Keep pitch** checkbox in the panel |
| Remember a channel's speed | **Remember &lt;channel&gt;** checkbox in the panel |

Hotkeys are ignored while you type in a comment box, search field or the address bar, so they will
not interrupt text entry.

### In the toolbar popup

Click the Speed Master icon to set the **default speed for every video**:

- Slider + presets, same 0.25x–4x range.
- **Reset 1x** returns to normal speed.
- **Keep pitch** sets the audio preference globally.
- **Presets** — add a speed, remove one (minimum three), or restore defaults.
- **Remembered channels** — every channel saved from the player, with per-row remove and
  **Clear all**.
- **Export / Import / Reset all** — JSON backup of speed, pitch, presets, channel memory and
  appearance settings.
- **Settings (⚙)** — opens the appearance and keyboard page described below.

Changes apply immediately to open YouTube tabs and are remembered across restarts. If you are
signed in to Chrome, they also sync to your other computers through your Chrome profile.

### Appearance and keyboard settings

Click the ⚙ button in the popup header (or `chrome://extensions` → Speed Master → **Extension
options**). Changes apply live to open tabs and are saved through Chrome sync.

| Setting | Range | Notes |
|---|---|---|
| Size | 80% – 140% | Scales the pill and panel |
| Transparency | 40% – 100% | Lower values fade the controls |
| Position | Bottom right / bottom left | Moves the pill inside the player |
| Auto-hide | On / off | Pill appears on hover or focus, stays visible while open |
| Enable shortcuts | On / off | Turns the `Shift` shortcuts off without disabling the panel |
| Step size | 0.05x – 0.50x | How much `Shift + .` / `Shift + ,` changes the speed |

A live preview at the top of the page reflects size, transparency and position. On Shorts pages the
panel is raised so it clears the action rail. **Reset appearance** restores the defaults; **Reset
everything** also clears speed, presets and remembered channels.

### Per-channel memory

Tick **Remember &lt;channel&gt;** in the player panel to give one channel its own speed. That rate
then wins over the global default whenever you watch the channel, and the popup lists it for
removal. Channels without an entry keep using the global default. Feature is off until you tick a
channel, and the entries are stored locally (not synced).

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

Only these values are stored:

| Key | Area | Meaning |
|---|---|---|
| `defaultRate` | `chrome.storage.sync` | Speed applied to new videos (0.25–4) |
| `preservesPitch` | `chrome.storage.sync` | Keep audio natural (`true`) or let it rise (`false`) |
| `presets` | `chrome.storage.sync` | Custom preset list (3–12 speeds) |
| `uiScale`, `uiOpacity`, `uiPosition`, `uiAutoHide` | `chrome.storage.sync` | Panel appearance |
| `hotkeysEnabled`, `hotkeyStep` | `chrome.storage.sync` | Shortcut toggle and step size |
| `channelRates` | `chrome.storage.local` | Per-channel speeds and names |

Nothing leaves your browser except Chrome's own profile sync, if you have it enabled. Channel
memory stays on this device. See [PRIVACY.md](PRIVACY.md).

### Backup, restore and reset

- **Export** in the popup writes `speed-master-settings.json` with your speed, pitch, presets,
  channel memory and appearance settings.
- **Import** reads that file back; invalid files are rejected without changing anything.
- **Reset all** clears every setting and channel entry.

To remove everything including storage, uninstall the extension.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| No speed pill on a video | Reload the tab. Confirm the site is `youtube.com`, not an embedded player on another site. |
| Pill appears but speed snaps back | Another extension is also setting playback rate. Disable the other speed extension and reload. |
| Hotkeys do nothing | Click once inside the page first. Hotkeys are disabled while a text field has focus, and can be turned off in the options page. |
| Panel is too small, too faint or on the wrong side | Toolbar icon → ⚙, then adjust size, transparency or position. |
| Speed is ignored on ads | Expected — ads are forced to 1x on purpose. |
| Audio sounds sped up | Enable **Keep pitch** in the panel or the popup. |
| A channel ignores the default speed | It has a remembered rate. Open the popup → **Remembered channels** → remove it. |
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
own. The only stored data is your playback preferences and optional channel memory. Full policy:
[PRIVACY.md](PRIVACY.md) · <https://deba608.github.io/youtube-speed-master/privacy.html>

Not affiliated with YouTube or Google. YouTube is a trademark of Google LLC.
