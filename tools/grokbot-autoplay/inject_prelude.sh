#!/usr/bin/env bash
# Touch/mode prelude for an AUTOPLAY WeChat build output (never a release output).
#   inject_prelude.sh <wechat-build-output-dir> [--mode out-and-back|observe|combo|combo:here|touch:t1|touch:<a,b>] [--scenarios <file.json>]
#   inject_prelude.sh <wechat-build-output-dir> --remove
# Prepends tools/grokbot-autoplay/prelude/gb-touch-prelude.js to game.js (backup game.js.gb-orig). --mode is the build "macro":
# sets GameGlobal.GROKBOT_AUTOPLAY (launch query autoplay=... still wins). --scenarios sets GameGlobal.GROKBOT_TOUCH_SCENARIOS.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; OUT="${1:?build output dir}"; shift; MODE=""; SCEN=""; REMOVE=0
while [ $# -gt 0 ]; do case "$1" in --mode) MODE="$2"; shift 2;; --scenarios) SCEN="$2"; shift 2;; --remove) REMOVE=1; shift;; *) echo "unknown $1"; exit 2;; esac; done
G="$OUT/game.js"; [ -f "$G" ] && [ ! -L "$G" ] || { echo "REFUSE: $G missing/symlink"; exit 1; }
if [ $REMOVE = 1 ]; then [ -f "$G.gb-orig" ] || { echo "REFUSE: no backup"; exit 1; }; mv "$G.gb-orig" "$G"; echo "RESTORED $G"; exit 0; fi
if grep -q '__gbTouch' "$G"; then echo "REFUSE: already injected"; exit 1; fi
case "$MODE" in ""|out-and-back|observe|off|combo|combo:here|combo:level|touch:*) ;; *) echo "bad --mode"; exit 2;; esac
extra=""; [ -n "$MODE" ] && extra="g.GROKBOT_AUTOPLAY=$(printf '%s' "$MODE" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))');"
if [ -n "$SCEN" ]; then python3 -c 'import json,sys;json.load(open(sys.argv[1]))' "$SCEN"; extra="$extra g.GROKBOT_TOUCH_SCENARIOS=$(python3 -c 'import json,sys;print(json.dumps(open(sys.argv[1]).read()))' "$SCEN");"; fi
cp "$G" "$G.gb-orig"; { python3 - "$here/prelude/gb-touch-prelude.js" "$extra" <<'PY'
import sys;s=open(sys.argv[1]).read();print(s.replace('/*__GB_MODE__*/',sys.argv[2]))
PY
cat "$G.gb-orig"; } > "$G.tmp" && mv "$G.tmp" "$G"
echo "INJECTED prelude into $G (mode=${MODE:-default} scenarios=${SCEN:-presets}); undo: $0 $OUT --remove"
