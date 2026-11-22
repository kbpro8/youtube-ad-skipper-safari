#!/bin/bash
#
# build.sh — hand-builds the "YouTube Ad Skipper" Safari Web Extension app
#            without requiring a full Xcode install (Command Line Tools only).
#
# Output: build/YouTube Ad Skipper.app
#

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

APP_NAME="YouTube Ad Skipper"
APP_BUNDLE="build/${APP_NAME}.app"
APPEX_NAME="YouTube Ad Skipper Extension"
APPEX_BUNDLE="${APP_BUNDLE}/Contents/PlugIns/${APPEX_NAME}.appex"

SDK="$(xcrun --show-sdk-path)"
TARGET="arm64-apple-macosx12.0"
BUILD_ID="com.riadi.youtubeadskipper"

echo "==> Cleaning build directory"
rm -rf build
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"
mkdir -p "${APP_BUNDLE}/Contents/PlugIns"
mkdir -p "${APPEX_BUNDLE}/Contents/MacOS"
mkdir -p "${APPEX_BUNDLE}/Contents/Resources"

# ---------------------------------------------------------------------------
echo "==> Compiling host app"
swiftc \
  -sdk "$SDK" \
  -target "$TARGET" \
  -O \
  -framework Cocoa \
  -emit-executable \
  -o "${APP_BUNDLE}/Contents/MacOS/YouTubeAdSkipper" \
  src/main.swift

# ---------------------------------------------------------------------------
echo "==> Compiling Safari Web Extension handler"
swiftc \
  -sdk "$SDK" \
  -target "$TARGET" \
  -O \
  -parse-as-library \
  -Xlinker -e -Xlinker _NSExtensionMain \
  -framework SafariServices \
  -framework Foundation \
  -emit-executable \
  -o "${APPEX_BUNDLE}/Contents/MacOS/YouTubeAdSkipperExtension" \
  src/SafariWebExtensionHandler.swift

# ---------------------------------------------------------------------------
echo "==> Copying plists"
cp resources/AppInfo.plist "${APP_BUNDLE}/Contents/Info.plist"
cp resources/ExtensionInfo.plist "${APPEX_BUNDLE}/Contents/Info.plist"

printf 'APPL????' > "${APP_BUNDLE}/Contents/PkgInfo"
printf 'XPC!????' > "${APPEX_BUNDLE}/Contents/PkgInfo"

# ---------------------------------------------------------------------------
echo "==> Copying web extension resources"
cp -R extension/. "${APPEX_BUNDLE}/Contents/Resources/"

# ---------------------------------------------------------------------------
# App icon (optional — skipped silently if iconutil is missing)
if command -v iconutil >/dev/null 2>&1 && [ -f extension/images/icon-128.png ]; then
  echo "==> Building app icon"
  ICONSET="$(mktemp -d)/AppIcon.iconset"
  mkdir -p "$ICONSET"
  SRC="extension/images/icon-128.png"
  for sz in 16 32 64 128 256 512; do
    sips -z $sz $sz "$SRC" --out "$ICONSET/icon_${sz}x${sz}.png" >/dev/null 2>&1 || true
    dbl=$((sz * 2))
    sips -z $dbl $dbl "$SRC" --out "$ICONSET/icon_${sz}x${sz}@2x.png" >/dev/null 2>&1 || true
  done
  if iconutil -c icns "$ICONSET" -o "${APP_BUNDLE}/Contents/Resources/AppIcon.icns" 2>/dev/null; then
    /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string AppIcon" \
      "${APP_BUNDLE}/Contents/Info.plist" 2>/dev/null || true
  fi
  rm -rf "$(dirname "$ICONSET")"
fi

# ---------------------------------------------------------------------------
echo "==> Code signing (ad-hoc)"
# Sign inner bundle first, then the outer app.
codesign --force --sign - --timestamp=none \
  --entitlements /dev/null \
  "${APPEX_BUNDLE}/Contents/MacOS/YouTubeAdSkipperExtension" 2>/dev/null || \
codesign --force --sign - --timestamp=none \
  "${APPEX_BUNDLE}/Contents/MacOS/YouTubeAdSkipperExtension"

codesign --force --sign - --timestamp=none "${APPEX_BUNDLE}"
codesign --force --sign - --timestamp=none "${APP_BUNDLE}"

echo "==> Verifying signature"
codesign --verify --deep --verbose=2 "${APP_BUNDLE}" 2>&1 | sed 's/^/    /' || true

# ---------------------------------------------------------------------------
echo ""
echo "✅ Build complete:"
echo "   ${PROJECT_DIR}/${APP_BUNDLE}"
echo ""
echo "Next steps:"
echo "   1. Enable Safari's Develop menu:"
echo "      Safari ▸ Settings ▸ Advanced ▸ “Show features for web developers”"
echo "   2. In Safari: Develop ▸ Allow Unsigned Extensions   (re-do after each Safari restart)"
echo "   3. Install the app:"
echo "      ./install.sh"
echo ""
