#!/usr/bin/env bash
# pricepulse build pipeline.
#
# Concatenates src/shared/{constants,browser,install_id}.js into the SW so
# JM_CONFIG / PP_CONFIG / PP_API / PP_getInstallId are global at runtime,
# which works in Chrome MV3 (service_worker) AND Firefox MV3 (background.scripts).
#
# Per L6 from the canon: build.sh always produces all 4 zips on `--zip`,
# including the source-zip (AMO requires source for any concatenated code).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/src"
DIST="$ROOT/dist"

VERSION="$(python3 -c 'import json;print(json.load(open("'"$ROOT"'/manifests/chrome.json"))["version"])')"
ZIP=0; if [ "${1:-}" = "--zip" ]; then ZIP=1; fi

rm -rf "$DIST"
mkdir -p "$DIST"

for browser in chrome firefox edge; do
  echo "→ building $browser"
  out="$DIST/$browser"
  mkdir -p "$out/background" "$out/popup" "$out/content" "$out/pages" "$out/icons" "$out/shared"

  # 1. Manifest
  cp "$ROOT/manifests/$browser.json" "$out/manifest.json"
  python3 -c "import json; json.load(open('$out/manifest.json'))" >/dev/null

  # 2. Concatenate shared/* + background/service-worker.js into a single SW file.
  #    Order matters: constants → browser polyfill → install_id → SW logic.
  {
    cat "$SRC/shared/constants.js"
    echo
    cat "$SRC/shared/browser.js"
    echo
    cat "$SRC/shared/install_id.js"
    echo
    cat "$SRC/background/service-worker.js"
  } > "$out/background/service-worker.js"

  # 3. Copy popup, pages, icons, shared (so HTML <script src="../shared/...">
  #    can still resolve in popup + options + welcome + app pages).
  cp -r "$SRC/popup/."   "$out/popup/"
  cp -r "$SRC/pages/."   "$out/pages/"
  cp -r "$SRC/icons/."   "$out/icons/"
  cp -r "$SRC/shared/."  "$out/shared/"

  echo "  ✓ $out"
done

if [ "$ZIP" -eq 1 ]; then
  cd "$DIST"
  for browser in chrome firefox edge; do
    rm -f "pricepulse-$browser-v$VERSION.zip"
    (cd "$browser" && zip -qr "../pricepulse-$browser-v$VERSION.zip" .)
    echo "  📦 $DIST/pricepulse-$browser-v$VERSION.zip ($(stat -c%s "pricepulse-$browser-v$VERSION.zip") bytes)"
  done
  # Source zip — AMO requires it because we concatenate the SW.
  cd "$ROOT"
  rm -f "$DIST/pricepulse-source-v$VERSION.zip"
  zip -qr "$DIST/pricepulse-source-v$VERSION.zip" \
    src/ manifests/ build.sh DOCS-CHEATSHEET.md \
    -x 'src/_marketing/*' 'src/_archive*' '*/__pycache__/*' '*.DS_Store'
  echo "  📦 $DIST/pricepulse-source-v$VERSION.zip ($(stat -c%s "$DIST/pricepulse-source-v$VERSION.zip") bytes)"
fi

echo "done."
