# Manual QA — YouTube Speed Master

Automated coverage (`npm run qa`): content-script injection, 3x apply, rate re-force, panel,
slider, Escape, hotkeys, ads, video replacement, SPA event, pitch, reload persistence, two-tab
sync, embed-shaped page, Shorts-shaped page.

These cases still need a human on real YouTube (`chrome://extensions` → Load unpacked):

| # | Case | Steps | Expected |
|---|---|---|---|
| 1 | Normal video | Open a watch page, set 3x | Plays at 3x, pitch natural, pill shows 3.00x |
| 2 | Live stream | Open a live video, set 2x | Rate applies; chat keeps working; seek/quality unaffected |
| 3 | Shorts | Open `/shorts/...`, swipe through 3–4 shorts | Each new short gets the saved speed |
| 4 | Playlist | Play a playlist, let it auto-advance | Next video keeps the speed |
| 5 | Ads | Find a video with a preroll/midroll, watch through it | Ad plays at 1x, `Ad · 1x` badge shows, speed restores after |
| 6 | Embed (direct) | Open `youtube.com/embed/<id>` directly | Speed applies, overlay visible |
| 7 | Embed (third-party iframe) | Video embedded on another site | **Out of scope** — manifest uses `all_frames: false`, so no overlay/injection there |
| 8 | SPA nav | From a watch page, click a related video | New video gets the speed, no page reload needed |
| 9 | Two tabs | Set 3x in tab A, open a new watch tab B | Tab B starts at 3x; changing one updates the other |
| 10 | Incognito | Allow the extension in incognito, open a video | Speed loads from sync storage and applies |
| 11 | Fullscreen | Enter fullscreen, open the panel | Pill/panel render above the video controls, usable |
| 12 | Popup | Change default in the toolbar popup, reload a tab | New page starts at the popup's default |
| 13 | Restart | Quit Chrome, reopen, play a video | Saved speed restores |
| 14 | Keyboard guard | Focus YouTube search, press `Shift+.` | Text is typed, speed does not change |
| 15 | Extreme speeds | Console `__ytSpeedMaster.setRate(16)` | Applies up to 16x; UI slider stays within 0.25–4 |

Report failures with: Chrome version, URL, ad/live/Shorts, expected vs actual, console errors
from the **YouTube Speed Master** context.
