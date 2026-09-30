#!/usr/bin/env bash
# Build a signed, installable tmp/Flowstate.ipa for a physical iPhone.
#
# Pipeline (modelled on ~/dev/stash/apps/ios/scripts/build-device.sh):
#   1. SwiftPM swift-rs cache fix (a tagless bare clone breaks tauri's build.rs).
#   2. `bunx tauri ios build --no-sign` (release, device). The build identity is passed to
#      src-tauri/build.rs through FLOWSTATE_BUILD / FLOWSTATE_HASH so Settings -> About matches.
#   3. Unzip the unsigned .ipa, stamp CFBundleVersion = `git rev-list --count HEAD`
#      (`tauri ios build` overwrites it with the static tauri.conf.json version).
#   4. Re-sign with the local "Apple Development" identity and a team provisioning profile
#      (wildcard profile under ~/Library/Developer/Xcode/UserData/Provisioning Profiles).
#      This avoids `xcodebuild -exportArchive`, which fails on this machine's Xcode.
#   5. Zip Payload/ to tmp/Flowstate.ipa and verify the stamp and embedded.mobileprovision.
#
# The keychain must be unlocked. Override the profile with PROFILE_PATH=/path/to.mobileprovision.
# Usage: scripts/ios-build-device.sh

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

TEAM_ID="VT79RNNS2U"
BUNDLE_ID="dev.flowstate.app"
SIGN_IDENTITY="Apple Development"
APP_NAME="Flowstate"
OUT_IPA="$ROOT/tmp/$APP_NAME.ipa"
UNSIGNED_IPA="$ROOT/src-tauri/gen/apple/build/arm64/$APP_NAME.ipa"
PROFILES_DIR="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"

if [[ ! -d src-tauri/gen/apple ]]; then
  echo "error: src-tauri/gen/apple is missing. Run: bunx tauri ios init" >&2
  exit 1
fi

BUILD_NUMBER="$(git rev-list --count HEAD)"
BUILD_HASH="$(git rev-parse --short HEAD)"
export FLOWSTATE_BUILD="$BUILD_NUMBER"
export FLOWSTATE_HASH="$BUILD_HASH"
echo "==> Build $BUILD_NUMBER ($BUILD_HASH)"

# 1. Pick a provisioning profile: explicit override, else a valid wildcard team profile with devices.
pick_profile() {
  local f plist
  for f in "$PROFILES_DIR"/*.mobileprovision; do
    [[ -f "$f" ]] || continue
    plist="$(mktemp)"
    security cms -D -i "$f" > "$plist" 2>/dev/null || { rm -f "$plist"; continue; }
    local appid expiry
    appid="$(plutil -extract Entitlements.application-identifier raw "$plist" 2>/dev/null || true)"
    expiry="$(plutil -extract ExpirationDate raw "$plist" 2>/dev/null || true)"
    rm -f "$plist"
    if [[ "$appid" == "$TEAM_ID.*" || "$appid" == "$TEAM_ID.$BUNDLE_ID" ]]; then
      if [[ -n "$expiry" && "$(date -u +%Y-%m-%dT%H:%M:%SZ)" < "$expiry" ]]; then
        echo "$f"
        return 0
      fi
    fi
  done
  return 1
}

PROFILE_PATH="${PROFILE_PATH:-}"
if [[ -z "$PROFILE_PATH" ]]; then
  PROFILE_PATH="$(pick_profile || true)"
fi
if [[ -z "$PROFILE_PATH" || ! -f "$PROFILE_PATH" ]]; then
  echo "error: no valid provisioning profile for team $TEAM_ID found in:" >&2
  echo "  $PROFILES_DIR" >&2
  echo "Build the app once from Xcode with automatic signing, or set PROFILE_PATH." >&2
  exit 1
fi
echo "==> Provisioning profile: $PROFILE_PATH"

if ! security find-identity -p codesigning -v | grep -q "$SIGN_IDENTITY"; then
  echo "error: no \"$SIGN_IDENTITY\" codesigning identity in the keychain (is it unlocked?)." >&2
  exit 1
fi

# 2. SwiftPM repository cache fix.
SWIFTPM_REPO_CACHE="${HOME:?HOME is not set}/Library/Caches/org.swift.swiftpm/repositories"
for CACHED in "$SWIFTPM_REPO_CACHE"/swift-rs-*; do
  [[ -d "$CACHED" ]] || continue
  if [[ -n "$(git --git-dir="$CACHED" tag 2>/dev/null | head -1)" ]]; then
    continue
  fi
  echo "==> Removing tagless SwiftPM cache clone $CACHED"
  rm -rf "$CACHED"
done

# A stale Rust static library in Externals would be bundled as a resource.
rm -f src-tauri/gen/apple/Externals/arm64/release/libapp.a src-tauri/gen/apple/Externals/arm64/debug/libapp.a
rm -f "$UNSIGNED_IPA"

echo "==> bunx tauri ios build --no-sign"
bunx tauri ios build --no-sign

if [[ ! -f "$UNSIGNED_IPA" ]]; then
  echo "error: expected unsigned IPA not found at $UNSIGNED_IPA" >&2
  ls -la "$ROOT/src-tauri/gen/apple/build" "$ROOT/src-tauri/gen/apple/build/arm64" >&2 || true
  exit 1
fi

# 3. Unzip, stamp, sign.
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
unzip -q "$UNSIGNED_IPA" -d "$WORKDIR"
APP_PATH="$WORKDIR/Payload/$APP_NAME.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "error: $APP_PATH not found in the unsigned IPA" >&2
  exit 1
fi

echo "==> Stamping CFBundleVersion $BUILD_NUMBER"
plutil -replace CFBundleVersion -string "$BUILD_NUMBER" "$APP_PATH/Info.plist"

ENTITLEMENTS="$WORKDIR/entitlements.plist"
cat > "$ENTITLEMENTS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>application-identifier</key>
  <string>${TEAM_ID}.${BUNDLE_ID}</string>
  <key>com.apple.developer.team-identifier</key>
  <string>${TEAM_ID}</string>
  <key>get-task-allow</key>
  <true/>
</dict>
</plist>
PLIST

cp "$PROFILE_PATH" "$APP_PATH/embedded.mobileprovision"
echo "==> Signing $APP_NAME.app"
codesign --force --sign "$SIGN_IDENTITY" --timestamp=none --entitlements "$ENTITLEMENTS" "$APP_PATH"
codesign --verify --strict "$APP_PATH"

# 4. Package.
mkdir -p "$ROOT/tmp"
rm -f "$OUT_IPA"
(cd "$WORKDIR" && zip -qry "$OUT_IPA" Payload)

# 5. Verify the packaged result, not the working copy.
CHECK="$(mktemp -d)"
unzip -q "$OUT_IPA" -d "$CHECK"
CHECK_APP="$CHECK/Payload/$APP_NAME.app"
STAMPED="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$CHECK_APP/Info.plist")"
SHORT="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$CHECK_APP/Info.plist")"
BID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$CHECK_APP/Info.plist")"
trap 'rm -rf "$WORKDIR" "$CHECK"' EXIT
if [[ "$STAMPED" != "$BUILD_NUMBER" ]]; then
  echo "error: CFBundleVersion in the IPA is '$STAMPED', expected '$BUILD_NUMBER'" >&2
  exit 1
fi
if ! unzip -l "$OUT_IPA" | grep -q "Payload/$APP_NAME.app/embedded.mobileprovision"; then
  echo "error: embedded.mobileprovision missing from $OUT_IPA" >&2
  exit 1
fi

echo ""
echo "==> Done"
echo "    bundle id:        $BID"
echo "    CFBundleVersion:  $STAMPED (short version $SHORT)"
echo "    build hash:       $BUILD_HASH"
echo "    profile:          $PROFILE_PATH"
echo "    IPA:              $OUT_IPA"
