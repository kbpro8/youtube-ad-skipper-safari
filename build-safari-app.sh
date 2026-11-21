#!/bin/zsh
# Wraps the web extension in a macOS app (required for a permanent Safari install) and builds it.
# Needs the full Xcode app (free on the Mac App Store), not just the Command Line Tools.
set -e
cd "$(dirname "$0")"

if ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  echo "Xcode is not installed or not selected."
  echo "1) Install Xcode from the Mac App Store"
  echo "2) Run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

if [ ! -d "YouTube Ad Skipper" ]; then
  xcrun safari-web-extension-converter extension \
    --project-location . \
    --app-name "YouTube Ad Skipper" \
    --bundle-identifier "com.local.youtubeadskipper" \
    --macos-only --swift --copy-resources --no-open --no-prompt --force
fi

cd "YouTube Ad Skipper"
xcodebuild -scheme "YouTube Ad Skipper" -configuration Release \
  -derivedDataPath build CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO build

APP="build/Build/Products/Release/YouTube Ad Skipper.app"
rm -rf "/Applications/YouTube Ad Skipper.app"
cp -R "$APP" /Applications/
open "/Applications/YouTube Ad Skipper.app"
echo "Done. Now enable it in Safari → Settings → Extensions."
