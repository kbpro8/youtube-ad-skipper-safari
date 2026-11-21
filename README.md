# YouTube Ad Skipper (Safari extension)

Skips YouTube video ads automatically and hides banner, feed, sidebar and overlay ads. You don't need YouTube Premium.

## What it does
- **Video ads (pre-roll and mid-roll):** clicks **Skip** the moment it appears. If an ad has no Skip button, the extension mutes it and jumps to the end (or plays it at 16× speed if YouTube blocks the jump). Your volume and playback speed come back once the ad is gone.
- **Static ads:** hides home-feed ads, search ads, the sidebar ad, the masthead banner, merch shelves and overlay banners.
- **The "Ad blockers are not allowed" pop-up:** closes it and resumes playback.
- **Toolbar pop-up:** an on/off switch and a count of skipped ads.

Files are in `extension/`: `content.js` (ad skipping), `hide-ads.css` (static ads), `popup.*` (toolbar UI).

## Install

### Option A: quick test, no Xcode (Safari 18 or later)
1. Safari → Settings → Advanced → tick **Show features for web developers**.
2. Safari → Settings → Developer → tick **Allow unsigned extensions**.
3. **Develop → Add Temporary Extension…** → select the `extension` folder.
4. Open youtube.com, click the extension's toolbar icon and grant access to youtube.com.

Safari removes temporary extensions when you quit it, so use Option B for permanent use.

### Option B: permanent app (needs Xcode, which is free)
1. Install **Xcode** from the Mac App Store and open it once.
2. In Terminal:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
   ```bash
   ./build-safari-app.sh
   ```
3. Safari → Settings → Developer → tick **Allow unsigned extensions** (needed because the app is signed locally).
4. Safari → Settings → **Extensions** → enable **YouTube Ad Skipper**, then allow it on youtube.com.

You'll need to re-tick "Allow unsigned extensions" each time Safari restarts. To avoid that, open the Xcode project, choose your free Apple ID under *Signing & Capabilities*, and build from Xcode.

## If ads start getting through again
YouTube changes its page code from time to time. The fix is usually a new class name:
- For video ads, add it to `SKIP_BUTTON_SELECTORS` in `extension/content.js`.
- For banner or feed ads, add it to `extension/hide-ads.css`.

Then reload the extension (Option A) or run `./build-safari-app.sh` again (Option B).

## License
[MIT](LICENSE). Free to use, change and share.
