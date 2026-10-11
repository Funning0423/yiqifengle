#!/usr/bin/env bash
#   uninstall.sh <project-root>   Removes exactly what install.sh added, after verifying each file is a regular file with the manifest SHA.
set -euo pipefail
ROOT="${1:?project root}"; P="$ROOT/creator-build-project"; S="$P/assets/scripts"; T="$S/grokbot-autoplay"; M="$P/.grokbot-autoplay.manifest"
sha(){ if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -c1-64; else shasum -a 256 "$1" | cut -c1-64; fi; }
[ -f "$M" ] && [ ! -L "$M" ] || { echo "REFUSE: no manifest $M (not installed by install.sh?)"; exit 1; }
[ -d "$T" ] && [ ! -L "$T" ] || { echo "REFUSE: $T missing or symlink"; exit 1; }
extra=$(cd "$T" && ls -A | grep -v -E '^Grokbot(Autoplay|AutoplaySequencer|TouchScenarios|Marks|Combo)\.ts(\.meta)?$' || true)
[ -z "$extra" ] || { echo "REFUSE: unexpected files in $T: $extra"; exit 1; }
while read -r want rel; do case "$want" in accepted-*) continue;; esac; f="$S/$rel"
  [ -f "$f" ] && [ ! -L "$f" ] || { echo "REFUSE: $rel missing/symlink"; exit 1; }
  [ "$(sha "$f")" = "$want" ] || { echo "REFUSE: $rel changed since install"; exit 1; }; done < "$M"
rm -f "$T"/GrokbotAutoplay.ts "$T"/GrokbotAutoplaySequencer.ts "$T"/GrokbotTouchScenarios.ts "$T"/GrokbotMarks.ts "$T"/GrokbotCombo.ts "$T"/*.ts.meta; rmdir "$T"; rm -f "$S/grokbot-autoplay.meta" "$M"
echo "UNINSTALLED. Source tree is back to its pre-install state (Creator drops the library cache entries on next import)."
