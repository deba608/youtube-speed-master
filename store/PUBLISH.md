# Publishing Speed Master to the Chrome Web Store (P6)

Everything that can be prepared from the repository is done. What remains needs a signed-in
Google account, the one-time developer fee and a final **Submit for review** click.

Use this as a keystroke-level walkthrough of the developer dashboard.

---

## 0. Pre-flight (verified)

| Check | Result |
|---|---|
| Upload artifact | `dist/youtube-speed-master-1.2.0.zip` — 32,090 bytes |
| SHA-256 | `585766185F32D5478D0F877D7BD32EEC0EEB4A51283C9D3BE75A7439648C757B` |
| ZIP entries | 13, forward-slash names, `manifest.json` at root, no dev files |
| Manifest | MV3, name **Speed Master**, version **1.2.0** |
| Permissions | `storage` only + content script on `*://*.youtube.com/*` |
| Remote code | none — all JS bundled |
| Privacy URL | <https://deba608.github.io/youtube-speed-master/privacy.html> (HTTP 200) |
| Homepage | <https://deba608.github.io/youtube-speed-master/> (HTTP 200) |
| Screenshots | 3 × 1280×800 in `store/` |
| Promo tile | 440×280 in `store/` |
| Automated QA | 61/61 local, 64/64 with real YouTube smoke |

Rebuild and re-hash before uploading if anything changed since:

```powershell
npm run package
(Get-FileHash .\dist\youtube-speed-master-1.2.0.zip -Algorithm SHA256).Hash
```

---

## 1. Developer account

1. Open <https://chrome.google.com/webstore/devconsole>.
2. Sign in with the Google account that should own the listing (use a durable account, not a
   throwaway — transfers are painful).
3. Accept the developer agreement and pay the **one-time $5 USD** registration fee.
4. Verify the contact email Google sends.
5. Fill the **Publisher** profile: public name (`Deba` or a studio name), support email
   (GitHub issues address is fine: `https://github.com/deba608/youtube-speed-master/issues`).
6. Enable **2-Step Verification** on the account if it is not already on — required for publishing.

---

## 2. Create the item and upload

1. Dashboard → **New item**.
2. Upload `dist/youtube-speed-master-1.2.0.zip`.
3. Confirm the parsed manifest shows name **Speed Master**, version **1.2.0**, one permission
   (`storage`) and a content script.
4. If the upload errors on the manifest, re-run `npm run package` and retry — never hand-zip, the
   entry names must use forward slashes.

---

## 3. Store listing tab

Copy these exactly.

| Field | Value |
|---|---|
| Name | `Speed Master` |
| Summary (≤132 chars) | `Play YouTube up to 4x with preset speeds, a slider and hotkeys. Pitch stays natural. No tracking.` |
| Category | `Productivity` → `Tools` |
| Language | `English` |
| Homepage URL | `https://github.com/deba608/youtube-speed-master` |
| Support URL | `https://github.com/deba608/youtube-speed-master/issues` |

**Description** — paste the `Detailed description` block from
[LISTING.md](LISTING.md#detailed-description). Keep the first paragraph as-is: it states the
single purpose in one sentence, which is what reviewers look for.

**Graphics**

| Slot | File |
|---|---|
| Store icon 128×128 | `icons/icon128.png` |
| Screenshot 1 (1280×800) | `store/screenshot-1.png` — panel open at 2.5x |
| Screenshot 2 (1280×800) | `store/screenshot-2.png` — popup defaults |
| Screenshot 3 (1280×800) | `store/screenshot-3.png` — hotkeys |
| Small promo tile 440×280 | `store/promo-440x280.png` |

Optional captions, in order:

1. Watch up to 4x — slider, presets and a live speed readout
2. Set your default once — synced through Chrome
3. Keyboard-first — Shift + . / Shift + , to step speed

> The screenshots are rendered from the real panel and popup CSS (`npm run assets`). If a reviewer
> asks for captures of the live product, load the unpacked extension, play a video and re-capture
> at 1280×800.

---

## 4. Privacy practices tab

**Single purpose** (required, one sentence):

```
Sets the HTML5 video playback rate on YouTube pages so viewers can watch faster or slower than the built-in 2x limit.
```

**Permission justification**

| Permission | Justification to paste |
|---|---|
| `storage` | `Saves the user's preferred playback speed and pitch setting locally and syncs them through their Chrome profile.` |
| Host/content script `*://*.youtube.com/*` | `Sets the playbackRate of the HTML5 video element and shows the speed panel on YouTube pages. No page data is read, stored or transmitted.` |

If the dashboard asks for a **remote code** declaration, answer **No — all code is bundled in the
package**.

**Data usage** — answer **No** to every collection question, then tick the certification box:

- Does the item collect personally identifiable information? **No**
- Health, financial, authentication, personal communications, location, web history, user activity,
  website content? **No**
- Is data sold to third parties? **No**
- Is data used or transferred for purposes unrelated to the single purpose? **No**
- Is data used to determine creditworthiness? **No**

**Privacy policy URL**

```
https://deba608.github.io/youtube-speed-master/privacy.html
```

---

## 5. Distribution tab

| Field | Value |
|---|---|
| Payments | Free |
| Visibility | Public |
| Regions | All regions |
| Mature content | No |

---

## 6. Submit

1. Re-read the listing preview: icon, three screenshots, 97-character summary.
2. Click **Submit for review**.
3. Expect an automated scan first (minutes), then human review — usually **1–3 business days** for
   established accounts, up to **1–2 weeks** for a first submission.
4. Leave the item in **Pending review**; editing it withdraws the submission, so wait it out.

---

## 7. If it is rejected

Fix only what the reviewer cites, bump the version, rebuild, re-upload.

| Likely reason | Response |
|---|---|
| Purpose unclear / too broad | Point at the first line of the description and the single-purpose field; both name playback rate on YouTube. |
| Unnecessary permission | Already minimal: `storage` + youtube.com content script only. No `tabs`, `scripting`, `webRequest`, no broad host access. |
| Remote code | Nothing is fetched or eval'd; `manifest_version: 3`, all JS in `src/`. |
| Trademark / impersonation | Name is **Speed Master**, icon is a neutral gauge, description ends with the “not affiliated with YouTube or Google” disclaimer. |
| Broken on install | Test once in a clean Chrome profile from the uploaded ZIP, not the dev folder. |
| Screenshot mismatch | Re-capture with the extension actually loaded on a real video. |

Bump procedure:

```powershell
# edit "version" in manifest.json and package.json, then
npm run package
npm run qa
```

---

## 8. After approval

- [ ] Open the public listing in a signed-out window and confirm icon, screenshots and summary.
- [ ] Install from the store into a clean profile, run through
      [GUIDE.md](../GUIDE.md#first-run), confirm the pill appears.
- [ ] Add the store link to `README.md` and `docs/index.html`.
- [ ] Tag the release: `git tag v1.2.0 && git push --tags`.
- [ ] Watch the developer dashboard for `chrome://extensions` error reports and reviews for the
      first week.

**Update flow:** change code → bump `version` in `manifest.json` + `package.json` → `npm run package`
→ dashboard → **Package** → upload → submit. Version numbers must strictly increase.

**Rollback:** dashboard → **Package** → **Unpublish** stops new installs immediately; existing
installs keep working until the next update. Keep the previous ZIP around for re-upload.

---

## 9. Optional follow-ups

- **Edge Add-ons** — accepts this MV3 ZIP as-is; new listing at
  <https://partner.microsoft.com/dashboard/microsoftedge>.
- **Firefox AMO** — needs `browser_specific_settings` in the manifest and a `browser.*` API shim;
  out of scope for v1.
