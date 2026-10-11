#!/usr/bin/env bash
# Voice bot windseam: TEST BUILDS ONLY. Prepends one line to a WeChat build output game.js that sets
#   GameGlobal.VB_SCENARIO='windseam' (+ optional GameGlobal.VB_QUERY) so VbWindSeamTest mounts without a launch query.
#   inject_windseam.sh <wechat-build-output-dir> [--query 'vbWindSec=30&vbWindDelay=1000&vbBgm=keep']
#   inject_windseam.sh <wechat-build-output-dir> --remove
# Backup: game.js.vb-orig. Independent of GGbot's inject_prelude.sh (game.js.gb-orig): if both are used, inject GGbot first,
# then this; remove this first, then GGbot's.
set -euo pipefail
OUT="${1:?build output dir}"; shift; Q=""; REMOVE=0
while [ $# -gt 0 ]; do case "$1" in --query) Q="$2"; shift 2;; --remove) REMOVE=1; shift;; *) echo "unknown $1"; exit 2;; esac; done
G="$OUT/game.js"; [ -f "$G" ] && [ ! -L "$G" ] || { echo "REFUSE: $G missing/symlink"; exit 1; }
if [ $REMOVE = 1 ]; then [ -f "$G.vb-orig" ] || { echo "REFUSE: no backup"; exit 1; }; mv "$G.vb-orig" "$G"; echo "RESTORED $G"; exit 0; fi
if grep -q 'VB_SCENARIO' "$G"; then echo "REFUSE: already injected"; exit 1; fi
case "$Q" in *[\'\"\\]*) echo "REFUSE: quotes/backslash in --query"; exit 2;; esac
cp "$G" "$G.vb-orig"
{ printf '%s\n' "(function(){var g=typeof GameGlobal!=='undefined'?GameGlobal:(typeof globalThis!=='undefined'?globalThis:this);g.VB_SCENARIO='windseam';g.VB_QUERY='$Q';try{if(typeof globalThis!=='undefined'&&globalThis!==g){globalThis.VB_SCENARIO='windseam';globalThis.VB_QUERY='$Q';}}catch(e){}})();"; cat "$G.vb-orig"; } > "$G.tmp" && mv "$G.tmp" "$G"
echo "INJECTED VB_SCENARIO=windseam into $G (query='$Q'); undo: $0 $OUT --remove"
