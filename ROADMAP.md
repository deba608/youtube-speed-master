# Speed Master — Roadmap

Post-1.0 plan. Every feature below stays inside the constraints that got v1.0.0 approved-ready:

- **`storage` permission only** — no `tabs`, `scripting`, `webRequest`, no broad host access.
- **No remote code, no analytics, no network requests.** Everything bundled.
- **Ads stay at 1x**; no ad skipping or blocking, ever.
- **UI caps at 4x.** Higher rates stay behind the console API.
- **Neutral branding** — no YouTube logo, no “official”, disclaimer always present.

Effort is rough (S < 1 day, M 1–3 days, L 1–2 weeks).

---

## Priority order

| # | Release | Feature | Value | Effort | Risk |
|---|---|---|---|---|---|
| 1 | 1.1.0 | Per-channel speed memory | High | M | Low |
| 2 | 1.1.0 | Custom preset editor | High | M | Low |
| 3 | 1.1.0 | Ad hand-off hardening | Medium | S | Low |
| 4 | 1.1.0 | Reset all + settings export | Medium | S | Low |
| 5 | 1.2.0 | Options page + panel appearance (size, transparency, position) | High | M | Low |
| 6 | 1.2.0 | Accessibility pass | Medium | M | Low |
| 7 | 1.2.0 | Shorts / Music / live-stream polish | High | M | Medium |
| 8 | 1.2.0 | Extended hotkeys | Medium | S | Low |
| 9 | 1.3.0 | Localization (5 languages) | Medium | M | Low |
| 10 | 1.3.0 | Firefox port (Edge already runs the same ZIP unpacked) | High | L | Medium |
| 11 | 2.0.0 | Speed profiles / rules | Medium | L | Medium |
| 12 | infra | CI + automated store package | High | S | Low |

Recommendation: **1.2.0 shipped** with appearance controls, an options page and configurable hotkeys.
The next release is **1.3.0** — localization and the Firefox port. Store listings are deferred:
GitHub release ZIPs are the only distribution channel for now.

---

## 1.1.0 — Memory (shipped 2026-11-06)

All four items below are implemented, covered by the automated QA suite and shipped in v1.1.0.

### 1.1 Per-channel speed memory

**Problem.** A viewer wants 2.5x for lectures, 1.25x for music, 1x for anything else. Today one
global default covers everything.

**Behavior**
- Panel gets a **Remember for this channel** toggle. Off by default — no silent surprises.
- When on, the channel’s rate is saved and applied automatically on that channel’s videos.
- Precedence: channel rate → global `defaultRate`.
- Popup lists remembered channels with a per-row remove and **Clear all**.
- Hotkey/slider changes update the channel rate only when the toggle is on.

**Data**
- `chrome.storage.local`, key `channelRates`: `{ [channelKey]: { rate, updated } }`.
- `channelKey` from the watch page owner link: `/@handle` or `/channel/UC…`; fall back to
  `/c/…` or `/user/…`. Skip when no owner link (embeds, some live pages).
- Cap at 500 entries, evict least-recently-updated. `storage.local` avoids the 8 KB item limit of
  `storage.sync`.
- Keep pitch global; do not store per channel.

**Permissions:** none new (`storage` covers `local`).

**Acceptance**
- Set 2.5x on channel A, 1.25x on channel B → navigating between them applies the right rate.
- Toggle off → channel rate ignored, global default applies.
- Clear all → one entry remains per active channel until re-saved.
- Works across SPA navigation and after a full reload.

### 1.2 Custom preset editor

**Problem.** The 11 fixed presets do not fit everyone; podcast listeners want 1.1x/1.9x.

**Behavior**
- Popup: edit mode to add/remove/reorder presets (3–12 entries, 0.25–4, 0.05 steps).
- Defaults preserved with **Restore defaults**.
- Panel renders the saved presets; the active one highlights.
- Empty input falls back to defaults, never leaves the panel with zero presets.

**Data:** `presets: number[]` in `storage.sync` (small, syncable).

**Acceptance**
- Custom set survives restart and syncs to a second profile.
- Invalid values are clamped, duplicates dropped.
- Panel and popup always agree.

### 1.3 Ad hand-off hardening

**Problem.** Ad detection relies on class names; a player change can leave the video at 1x or
restore the wrong rate.

**Behavior**
- Track `desiredRate` and `appliedRate` separately; during an ad, never write the desired rate.
- Detect ads via `.ad-showing`, `.ytp-ad-player-overlay`, and the ad module’s `ad-ended` event.
- On ad end, re-apply `desiredRate` once, then resume the `ratechange` guard.
- Add a 1x fallback timer if the ad class disappears without an event.

**Acceptance**
- Pre-roll, mid-roll and ad pod: speed returns exactly once, no flicker.
- A 4x video followed by an ad and back returns to 4x, not 1x.
- No write storms in the console during ads.

### 1.4 Reset all + settings export

- **Reset all** in the popup: clears `defaultRate`, `preservesPitch`, presets and channel memory.
- **Export/Import JSON** in the popup footer: one file, versioned schema, validated on import.
- No server, no clipboard permissions — download/blob + file input only.

**Acceptance**
- Export → reset → import restores every setting.
- Malformed file is rejected with a message, nothing partially applied.

---

## 1.2.0 — Control (shipped 2026-11-06)

### 1.5 Options page

`options_ui` in the manifest (new tab, not embedded), still no new permission. Shipped with:

- Panel appearance: size (80–140%), transparency (40–100%), left/right position, auto-hide.
- Live preview of the panel styling.
- Step size for hotkeys (0.05 / 0.1 / 0.25 / 0.5).
- Enable/disable hotkeys and a list of the current bindings.
- **Reset appearance** and **Reset everything**.
- Popup header ⚙ button opens the same page.

### 1.6 Accessibility pass

- `Esc` returns focus to the pill; the close button does too.
- `aria-live="polite"` announcement on speed change (“Playback speed 2.50x”).
- Native range semantics for the slider (arrow keys, `Home`/`End`).
- Respects `prefers-reduced-motion`; labelled controls throughout.

**Acceptance:** covered in `tests/qa.mjs` (focus return, live region, keyboard-only speed changes).

### 1.7 Shorts, Music and live polish

- Shorts: the panel is raised on `/shorts/` pages so it clears the action rail.
- `music.youtube.com`: inherits the same content-script match and panel.
- Live streams: the 1-second safety net and `ratechange` guard re-apply after DVR reconnects;
  no writes during buffering beyond the normal apply path.
- Embedded `youtube.com/embed/…` stays out of scope (`all_frames: false`).

### 1.8 Extended hotkeys

| Keys | Action |
|---|---|
| `Shift + .` / `Shift + ,` | ± one step (configurable size) |
| `Shift + 0` | Reset to 1x |
| `Shift + 1…4` | Jump to 1x / 2x / 3x / 4x |
| `Esc` | Close panel, return focus |

Typing in inputs, textareas, contenteditable and the search box stays ignored.

---

## 1.3.0 — Reach (target: quarter out)

### 1.9 Localization

- `_locales/` + `default_locale: "en"`; all UI strings through `chrome.i18n`.
- First wave: English, Spanish, Portuguese (BR), German, French, Hindi.
- Store listing localized for the same five.
- Keep the detailed description readable by machine translation; no idioms.

### 1.10 Firefox + Edge

- **Edge:** already runs the same MV3 ZIP unpacked; a Partner Center listing is free but deferred
  until store listings are back in scope.
- **Firefox:** `browser_specific_settings.gecko.id`, promise-based storage shim, MV3 background
  differences, AMO package script, `data_collection_permissions` declaration.
- Shared core stays one file; platform shim selected at build time.

### 1.11 Store assets refresh

- Replace rendered screenshots with captures from the real extension.
- One animated GIF/WebM for the listing (≤ 5 MB).
- Localized screenshots for the five languages.

---

## 2.0.0 — Automation (exploratory)

- **Speed profiles / rules:** match by channel, duration, playlist, or music.youtube.com; first
  match wins, visible rule list.
- **Custom keyboard shortcuts** via `commands` (needs a manifest `commands` block, no permission
  prompt) for users who want `Alt+↑`.
- **Temporary speed:** “until I reload” mode that does not touch the saved default.
- **Optional local-only stats** (time saved this week). Off by default, never transmitted, no
  identifiers. Ship only if it stays trivially auditable.

---

## Infrastructure

| Item | Why | Effort |
|---|---|---|
| GitHub Actions CI (`check` + `qa` on push/PR) | Catch regressions without a manual run | S |
| Tag-driven release workflow | Build ZIP, verify hash, attach to release | S |
| Issue templates + `SECURITY.md` | Cleaner reports, responsible disclosure | S |
| Dependabot for Playwright | Keep the QA harness current | S |
| Coverage for storage migration | Settings schema changes must not wipe users | M |

CI runs headless Chromium via Playwright on `ubuntu-latest`; the DNS-mapped fixture already works
there. Store upload stays manual — it needs the developer account.

---

## Explicitly declined

| Idea | Why not |
|---|---|
| Ad skipping / blocking / muting | Violates “ads stay at 1x” and store policy risk |
| Volume boost, EQ, downloads | Outside the single purpose; invites rejection |
| SponsorBlock integration | Remote service + scope creep |
| Remote config or feature flags | Remote code / policy violation |
| Analytics or crash reporting | Privacy promise is a selling point |
| Auto-clicking YouTube UI | Fragile and looks like automation to reviewers |
| Lifting the 4x UI cap | Quality collapses; keep it console-only |

---

## Delivery rules

1. One feature per branch, PR into `main`, QA green before merge.
2. Update `CHANGELOG.md` in the same PR.
3. Bump minor version for features, patch for fixes; tag `vX.Y.Z` and attach the built ZIP.
4. Any change to storage keys ships with a migration and a QA case that starts from the old schema.
5. Re-run `npm run package` and re-check the listing text before every store submission.
6. Update `store/PUBLISH.md` if the dashboard asks for anything new (permissions, data types).
