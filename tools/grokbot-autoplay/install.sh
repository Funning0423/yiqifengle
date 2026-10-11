#!/usr/bin/env bash
# T0 GROKBOT_AUTOPLAY installer (GGbot). Bash 3.2 compatible (macOS).
#   install.sh <project-root> [--check] [--accept-unknown]
#   <project-root> = directory that contains creator-build-project/ (an ISOLATED copy, never the original project).
# Copies 6 .ts + fixed .meta into creator-build-project/assets/scripts/grokbot-autoplay/ (no existing file is modified).
# Refuses on: symlinked path components, existing target, unknown strict prereq SHA. Any failure after writing -> full removal.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; ROOT="${1:?project root}"; shift || true
CHECK=0; ACCEPT=0; for a in "$@"; do case "$a" in --check) CHECK=1;; --accept-unknown) ACCEPT=1;; *) echo "unknown arg $a"; exit 2;; esac; done
sha(){ if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -c1-64; else shasum -a 256 "$1" | cut -c1-64; fi; }
P="$ROOT/creator-build-project"; S="$P/assets/scripts"; T="$S/grokbot-autoplay"; M="$P/.grokbot-autoplay.manifest"
for d in "$ROOT" "$P" "$P/assets" "$S"; do if [ -L "$d" ] || [ ! -d "$d" ]; then echo "REFUSE: $d is not a real directory"; exit 1; fi; done
if [ -e "$T" ] || [ -L "$T" ] || [ -e "$S/grokbot-autoplay.meta" ] || [ -e "$M" ]; then echo "REFUSE: already installed or leftover ($T / .meta / manifest)"; exit 1; fi
bad=0; warn=0
while read -r level want path _; do case "$level" in strict|observe) ;; *) continue;; esac
  f="$S/$path"; if [ -L "$f" ] || [ ! -f "$f" ]; then got=MISSING; else got=$(sha "$f"); fi
  echo "$path $got" ; done < "$here/prereq-allowlist.txt" | sort -u > "${TMPDIR:-/tmp}/gb-t0-cur.$$"
for path in $(awk '/^(strict|observe) /{print $3}' "$here/prereq-allowlist.txt" | sort -u); do
  got=$(awk -v p="$path" '$1==p{print $2}' "${TMPDIR:-/tmp}/gb-t0-cur.$$" | head -1)
  level=$(awk -v p="$path" '$3==p{print $1}' "$here/prereq-allowlist.txt" | head -1)
  if awk -v p="$path" -v g="$got" '$3==p && $2==g{f=1} END{exit f?0:1}' "$here/prereq-allowlist.txt"; then echo "ok      $level $path $got"
  elif [ "$level" = strict ]; then echo "UNKNOWN strict  $path $got"; bad=1; else echo "WARN    observe $path $got (observer may log *-unavailable)"; warn=1; fi
done; rm -f "${TMPDIR:-/tmp}/gb-t0-cur.$$"
if [ $bad = 1 ] && [ $ACCEPT = 0 ]; then echo "REFUSE: unknown strict prerequisite (re-run with --accept-unknown only after reviewing the glue against that file)"; exit 1; fi
[ $CHECK = 1 ] && { echo "CHECK OK (zero writes)"; exit 0; }
stage="$P/.grokbot-autoplay-staging.$$"; trap 'rm -rf "$stage"' EXIT
mkdir "$stage"; mkdir "$stage/grokbot-autoplay"
for f in GrokbotAutoplay.ts GrokbotAutoplaySequencer.ts GrokbotTouchScenarios.ts GrokbotMarks.ts GrokbotCombo.ts GrokbotBoot.ts; do cp "$here/src/$f" "$here/src/$f.meta" "$stage/grokbot-autoplay/"; done
cp "$here/src/grokbot-autoplay.dir.meta" "$stage/grokbot-autoplay.meta"
rollback(){ rm -rf "$T"; rm -f "$S/grokbot-autoplay.meta" "$M"; echo "ROLLED BACK: nothing left in $S"; }
{ mv "$stage/grokbot-autoplay" "$T" && mv "$stage/grokbot-autoplay.meta" "$S/grokbot-autoplay.meta"; } || { rollback; exit 1; }
: > "$M.tmp"; for f in "$T"/* "$S/grokbot-autoplay.meta"; do echo "$(sha "$f") ${f#$S/}" >> "$M.tmp"; done
for f in GrokbotAutoplay.ts GrokbotAutoplaySequencer.ts GrokbotTouchScenarios.ts GrokbotMarks.ts GrokbotCombo.ts GrokbotBoot.ts GrokbotAutoplay.ts.meta GrokbotAutoplaySequencer.ts.meta GrokbotTouchScenarios.ts.meta GrokbotMarks.ts.meta GrokbotCombo.ts.meta GrokbotBoot.ts.meta; do
  [ "$(sha "$T/$f")" = "$(sha "$here/src/$f")" ] || { echo "VERIFY FAILED $f"; rm -f "$M.tmp"; rollback; exit 1; }; done
mv "$M.tmp" "$M"; [ $ACCEPT = 1 ] && [ $bad = 1 ] && echo "accepted-unknown-strict-prereq $(date -u +%FT%TZ)" >> "$M"
echo "INSTALLED -> $T"; cat "$M"
echo "NEXT: build with a SEPARATE outputName (autoplay build). Never ship this build. Run uninstall.sh afterwards, then check_release_strip.sh on any release build."
