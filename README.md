# YouTube Ad Skipper (Safari extension)

Skips YouTube video ads automatically and hides banner, feed, sidebar and overlay ads.
You don't need YouTube Premium.

Works on the watch page, Shorts, embeds and the mobile site.
The same `extension/` folder also loads in Chrome, Edge and Brave.

---

## What it does

**Video ads (pre-roll and mid-roll)**
- Clicks **Skip** the moment the button appears.
- If there's no Skip button, it mutes the ad and jumps straight to its end.
- If YouTube blocks the jump, it plays the ad at 16× speed instead.
- Volume, mute state and playback speed are restored once the ad is gone.

**Static ads**
- Hides home-feed ads, search ads, the sidebar ad, the masthead banner,
  merch shelves, companion slots and overlay banners.

**The "Ad blockers are not allowed" pop-up**
- Closes it and resumes playback.

**Toolbar pop-up**
- On/off switch and a count of how many ads were skipped.

**Shorts**
- Skips ads in the Shorts feed and hides ad items.

---

## Files

| Path | Purpose |
|---|---|
| `extension/` | The web extension itself |
| `extension/content.js` | Ad detection, skipping, muting, pop-up dismissal |
| `extension/hide-ads.css` | Hides static/feed/sidebar ads |
| `extension/popup.*` | Toolbar UI (toggle + counter) |
| `extension/images/` | Icons |
| `userscript/youtube-ad-skipper.user.js` | Same logic as a userscript |
| `build-safari-app.sh` | Builds the macOS app with Apple's official converter |
| `build-no-xcode.sh` | Builds the macOS app with only Command Line Tools |
| `tools/make_icons.py` | Regenerates the icons (pure Python, no dependencies) |

---

## Install

### Option A — Safari, quick test (no Xcode)

Safari can load the extension folder directly for testing.

1. Safari → **Settings → Advanced** → tick **Show features for web developers**.
2. Safari → **Settings → Developer** → tick **Allow unsigned extensions**.
3. **Develop → Add Temporary Extension…** → select the `extension` folder.
4. Open youtube.com. Click the extension's toolbar icon and **grant access to youtube.com**.

Safari removes temporary extensions when you quit, so use Option B for permanent use.

---

### Option B — Safari, permanent app (needs Xcode, free)

1. Install **Xcode** from the Mac App Store and open it once.
2. In Terminal:

   ```bash
   ./build-safari-app.sh
   open "YouTube Ad Skipper/YouTube Ad Skipper.xcodeproj"
   ```

3. In Xcode: select the **YouTube Ad Skipper** target → **Signing & Capabilities** →
   choose your personal team (a free Apple ID works).
4. Press **Run**. The app is installed in your Applications folder.
5. Safari → **Settings → Extensions** → tick **YouTube Ad Skipper** → allow youtube.com.

---

### Option C — Chrome / Edge / Brave (fastest, 30 seconds)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.
4. Open YouTube.

---

### Option D — Safari via the Userscripts app (no Xcode)

1. Install [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) from the App Store.
2. Safari → **Settings → Extensions** → enable **Userscripts** → allow youtube.com.
3. Open the Userscripts app once and pick a script folder.
4. Copy `userscript/youtube-ad-skipper.user.js` into that folder.
5. Reload YouTube.

---

### Option E — Build the app without Xcode

If you only have the Command Line Tools (no full Xcode), you can still produce a
`.app` bundle with `swiftc`:

```bash
./build-no-xcode.sh     # builds build/YouTube Ad Skipper.app
./install-no-xcode.sh   # copies it to /Applications and registers it
```

Then enable it in Safari → Settings → Extensions.

> Note: macOS only lets Safari load extensions signed with a real Apple
> Developer certificate. With `codesign --sign -` (ad-hoc) the bundle builds and
> installs, but Safari won't list it. Use Option A or B unless you have a
> signing identity — check with `security find-identity -v -p codesigning`.

---

## How it works

`content.js` runs at `document_start` and then checks the page every 200 ms,
plus a `MutationObserver` for instant reaction.

1. **Detect** — the player has class `ad-showing` / `ad-interrupting`,
   or `.ytp-ad-player-overlay-layout` / `.ytp-ad-duration-remaining` is present.
2. **Mute** — save the current volume/mute/rate, then `video.muted = true`.
3. **Skip** — click every visible skip button
   (`.ytp-skip-ad-button`, `.ytp-ad-skip-button`, `.ytp-ad-skip-button-modern`, …).
4. **Jump** — set `video.currentTime = duration - 0.15`.
5. **Speed up** — if steps 3–4 did nothing, set `video.playbackRate = 16`.
6. **Restore** — when the ad ends, put back playback rate, volume and mute state,
   and resume the real video if the ad left it paused.

Static ads are removed twice over: by `hide-ads.css` and by setting
`display: none` from the content script (for ads injected after page load).

---

## Troubleshooting

**Nothing happens at all**
Check the extension has permission for youtube.com. In Safari:
Settings → Extensions → YouTube Ad Skipper → make sure youtube.com is allowed.

**Ads play but aren't skipped**
YouTube changes its markup regularly. The selectors live in
`SKIP_BUTTON_SELECTORS` at the top of `extension/content.js`. Open the page with
the Web Inspector, find the current skip button class, and add it to that list.

**The counter doesn't move**
The counter only increments when a Skip click or a jump actually happens.
Ads that are skipped by YouTube itself aren't counted.

---

## Notes

- Built for personal use. Use at your own discretion.
- YouTube occasionally changes how it serves ads and how it detects blockers.
  This extension is a moving target and may need selector updates.
- `content.js` is deliberately dependency-free so it stays easy to audit.

---

## License

MIT — see [LICENSE](LICENSE).
