#!/usr/bin/env bash
#   check_release_strip.sh <build-output-dir> [<project-root>]            exit 0 = CLEAN (no T0 code/strings)
#   check_release_strip.sh <build-output-dir> --expect-present            exit 0 = the AUTOPLAY build really contains T0
set -uo pipefail
#   check_release_strip.sh <build-output-dir> --pre-transition            exit 0 = test-only __qfPreTransition (if shipped) is
#                                                                          always next to its release gate (envVersion develop/trial + qfPre)
OUT="${1:?build output dir}"; ARG="${2:-}"
if [ "$ARG" = "--pre-transition" ]; then
  bad=0; files=$(grep -rIlE '__qfPreTransition' "$OUT" 2>/dev/null || true)
  for f in $files; do if ! grep -qE 'develop' "$f" || ! grep -qE 'trial' "$f" || ! grep -qE 'qfPre=' "$f"; then echo "UNGATED: __qfPreTransition without release gate in $f"; bad=1; fi; done
  [ $bad = 1 ] && exit 1; echo "PRE-TRANSITION GATED: $(echo "$files" | grep -c . ) file(s) carry __qfPreTransition, each with the develop/trial + qfPre gate (runtime-off in WeChat release)"; exit 0
fi
PAT='GB_MARK|GROKBOT_AUTOPLAY|GROKBOT_TOUCH_SCENARIOS|__GB_AUTOPLAY|__GB_MARKS|__gbTouch|GrokbotAutoplay|GrokbotTouchScenarios|GrokbotMarks|GrokbotCombo|GrokbotBoot|__gbBoot|gb-combo|grokbot-autoplay|autoplay-armed|out-and-back|92fca7bf|59ace17b|24830118|d370c13f|16cf1f79|c0b1e7a5|c23d5e95'
hits=$(grep -rIlE "$PAT" "$OUT" 2>/dev/null | grep -v '\.gb-orig$' || true)
if [ "$ARG" = "--expect-present" ]; then [ -n "$hits" ] && { echo "PRESENT (autoplay build):"; echo "$hits"; exit 0; }; echo "MISSING: autoplay build has no T0 code"; exit 1; fi
src=0; if [ -n "$ARG" ]; then S="$ARG/creator-build-project/assets/scripts"; if [ -e "$S/grokbot-autoplay" ] || [ -e "$S/grokbot-autoplay.meta" ] || [ -e "$ARG/creator-build-project/.grokbot-autoplay.manifest" ]; then echo "DIRTY SOURCE: T0 still installed in $ARG"; src=1; fi; fi
if [ -n "$hits" ]; then echo "NOT CLEAN: T0 strings found in:"; echo "$hits"; grep -rIoE "$PAT" "$OUT" | sort | uniq -c | head -20; exit 1; fi
[ $src = 1 ] && exit 1
echo "CLEAN: 0 files in $OUT match T0 patterns"; exit 0
