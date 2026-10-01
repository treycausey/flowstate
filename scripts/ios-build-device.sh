#!/usr/bin/env bash
# Build a signed, installable tmp/Flowstate.ipa for a physical iPhone.
#
# Pipeline (modelled on ~/dev/stash/apps/ios/scripts/build-device.sh):
#   1. SwiftPM swift-rs cache fix (a tagless bare clone breaks tauri's build.rs).
#   2. `bunx tauri ios build --no-sign` (release, device). The build identity is passed to
#      src-tauri/build.rs through FLOWSTATE_BUILD / FLOWSTATE_HASH so Settings -> About matches.
#   3. Unzip the unsigned .ipa, stamp CFBundleVersion = `git rev-list --count HEAD`
#      (`tauri ios build` overwrites it with the static tauri.conf.json version).
#   4. Re-sign with the keychain identity named in the profile's DeveloperCertificates
#      (development profile (exact bundle id preferred over wildcard) under ~/Library/Developer/Xcode/UserData/Provisioning Profiles).
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

# 1. Pick a development provisioning profile and the signing identity inside it.
# A usable profile is unexpired, matches the team (exact bundle id or wildcard), is a development
# profile (get-task-allow true) and lists devices (ProvisionedDevices). The exact bundle id profile
# wins over the wildcard. The identity is the keychain certificate whose SHA-1 is in the profile's
# DeveloperCertificates; signing by SHA-1 avoids picking a certificate the profile does not trust.
profile_score() {
  local f="$1" plist appid expiry task devices
  plist="$(mktemp)"
  if ! security cms -D -i "$f" > "$plist" 2>/dev/null; then rm -f "$plist"; return 1; fi
  appid="$(plutil -extract Entitlements.application-identifier raw "$plist" 2>/dev/null || true)"
  expiry="$(plutil -extract ExpirationDate raw "$plist" 2>/dev/null || true)"
  task="$(plutil -extract Entitlements.get-task-allow raw "$plist" 2>/dev/null || true)"
  devices="$(plutil -extract ProvisionedDevices raw "$plist" 2>/dev/null || true)"
  rm -f "$plist"
  [[ "$task" == "true" ]] || return 1
  [[ "$devices" =~ ^[0-9]+$ && "$devices" -gt 0 ]] || return 1
  [[ -n "$expiry" && "$(date -u +%Y-%m-%dT%H:%M:%SZ)" < "$expiry" ]] || return 1
  if [[ "$appid" == "$TEAM_ID.$BUNDLE_ID" ]]; then echo 2
  elif [[ "$appid" == "$TEAM_ID.*" ]]; then echo 1
  else return 1
  fi
}

pick_profile() {
  local f score best="" best_score=0
  for f in "$PROFILES_DIR"/*.mobileprovision; do
    [[ -f "$f" ]] || continue
    score="$(profile_score "$f" || true)"
    if [[ -n "$score" && "$score" -gt "$best_score" ]]; then
      best="$f"
      best_score="$score"
    fi
  done
  [[ -n "$best" ]] || return 1
  echo "$best"
}

# SHA-1 of every certificate in the profile whose private key is a valid codesigning identity.
pick_identity() {
  local profile="$1" plist idx der sha identities
  identities="$(security find-identity -p codesigning -v)"
  plist="$(mktemp)"
  security cms -D -i "$profile" > "$plist"
  idx=0
  while der="$(plutil -extract "DeveloperCertificates.$idx" raw -o - "$plist" 2>/dev/null)"; do
    sha="$(printf '%s' "$der" | base64 -D | openssl dgst -sha1 | awk '{print toupper($NF)}')"
    if [[ "$identities" == *"$sha"* ]]; then
      rm -f "$plist"
      echo "$sha"
      return 0
    fi
    idx=$((idx + 1))
  done
  rm -f "$plist"
  return 1
}

PROFILE_PATH="${PROFILE_PATH:-}"
if [[ -z "$PROFILE_PATH" ]]; then
  PROFILE_PATH="$(pick_profile || true)"
fi
if [[ -z "$PROFILE_PATH" || ! -f "$PROFILE_PATH" ]]; then
  echo "error: no valid development provisioning profile (get-task-allow, with devices) for team $TEAM_ID in:" >&2
  echo "  $PROFILES_DIR" >&2
  echo "Build the app once from Xcode with automatic signing, or set PROFILE_PATH." >&2
  exit 1
fi
# An override must pass the same development-profile checks as an auto-picked profile.
if [[ -z "$(profile_score "$PROFILE_PATH" || true)" ]]; then
  echo "error: $PROFILE_PATH is not a valid development profile (get-task-allow, devices, unexpired) for $TEAM_ID.$BUNDLE_ID" >&2
  exit 1
fi
PROFILE_NAME="$(security cms -D -i "$PROFILE_PATH" | plutil -extract Name raw -o - - 2>/dev/null || echo unknown)"
echo "==> Provisioning profile: $PROFILE_NAME ($PROFILE_PATH)"

SIGN_SHA1="$(pick_identity "$PROFILE_PATH" || true)"
if [[ -z "$SIGN_SHA1" ]]; then
  echo "error: no codesigning identity in the keychain matches a certificate in the profile (is the keychain unlocked?)." >&2
  exit 1
fi
echo "==> Signing identity SHA-1: $SIGN_SHA1"

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
codesign --force --sign "$SIGN_SHA1" --timestamp=none --entitlements "$ENTITLEMENTS" "$APP_PATH"
codesign --verify --strict "$APP_PATH"

# 4. Package.
mkdir -p "$ROOT/tmp"
rm -f "$OUT_IPA"
(cd "$WORKDIR" && zip -qry "$OUT_IPA" Payload)

# 5. Verify the packaged result, not the working copy.
CHECK="$(mktemp -d)"
trap 'rm -rf "$WORKDIR" "$CHECK"' EXIT
unzip -q "$OUT_IPA" -d "$CHECK"
CHECK_APP="$CHECK/Payload/$APP_NAME.app"
STAMPED="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$CHECK_APP/Info.plist")"
SHORT="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$CHECK_APP/Info.plist")"
BID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$CHECK_APP/Info.plist")"
if [[ "$STAMPED" != "$BUILD_NUMBER" ]]; then
  echo "error: CFBundleVersion in the IPA is '$STAMPED', expected '$BUILD_NUMBER'" >&2
  exit 1
fi
if [[ ! -f "$CHECK_APP/embedded.mobileprovision" ]]; then
  echo "error: embedded.mobileprovision missing from $OUT_IPA" >&2
  exit 1
fi

echo ""
echo "==> Done"
echo "    bundle id:        $BID"
echo "    CFBundleVersion:  $STAMPED (short version $SHORT)"
echo "    build hash:       $BUILD_HASH"
echo "    profile:          $PROFILE_NAME ($PROFILE_PATH)"
echo "    identity SHA-1:   $SIGN_SHA1"
echo "    IPA:              $OUT_IPA"
