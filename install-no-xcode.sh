#!/bin/bash
#
# install.sh — installs "YouTube Ad Skipper.app" into /Applications
#              and registers the Safari extension with pluginkit.
#

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="YouTube Ad Skipper"
SRC_APP="${PROJECT_DIR}/build/${APP_NAME}.app"
DEST_APP="/Applications/${APP_NAME}.app"
APPEX_ID="com.riadi.youtubeadskipper.extension"

if [ ! -d "$SRC_APP" ]; then
  echo "❌ Build not found. Run ./build.sh first."
  exit 1
fi

echo "==> Quitting Safari (needed to reload extensions)"
osascript -e 'tell application "Safari" to quit' 2>/dev/null || true
sleep 2

echo "==> Removing previous install (if any)"
if [ -d "$DEST_APP" ]; then
  rm -rf "$DEST_APP"
fi

echo "==> Copying app to /Applications"
cp -R "$SRC_APP" "$DEST_APP"

echo "==> Re-signing in place"
codesign --force --sign - --timestamp=none "$DEST_APP" 2>/dev/null || true

echo "==> Registering extension with pluginkit"
pluginkit -a "${DEST_APP}/Contents/PlugIns/${APP_NAME} Extension.appex" 2>/dev/null || true
pluginkit -e use -i "$APPEX_ID" 2>/dev/null || true

echo "==> Refreshing Launch Services"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "$DEST_APP" 2>/dev/null || true

echo ""
echo "==> pluginkit status:"
pluginkit -m -i "$APPEX_ID" 2>/dev/null || echo "    (not listed yet — open the app once, then check Safari Settings ▸ Extensions)"

echo ""
echo "✅ Installed to: $DEST_APP"
echo ""
echo "FINAL STEPS IN SAFARI:"
echo "  1. Open the app once:  open \"$DEST_APP\""
echo "  2. Safari ▸ Settings ▸ Advanced ▸ tick “Show features for web developers”"
echo "  3. Safari ▸ Develop ▸ Allow Unsigned Extensions"
echo "  4. Safari ▸ Settings ▸ Extensions ▸ tick “YouTube Ad Skipper”"
echo "  5. Allow access to youtube.com when prompted"
echo ""
