#!/usr/bin/env bash
# E1 build guard: Creator 3.8.8 CLI builds fail asset import ~1 in 2 (asset-db "ready" with nothing imported). Such a run
# gives a ~2.3 MB package, logs 「当前初始场景不存在」 and rewrites ~400 .meta files to importer "*". This wrapper only passes a
# build that is > MIN_BYTES, has no such error and leaves `git status --porcelain` empty; otherwise it restores the metas,
# drops library/temp and retries (MAX_TRIES), then fails loudly. Caches are removed afterwards (the Mac disk is tight).
# Works with macOS /bin/bash 3.2 (run it as `bash tools/build-guard/build-wechat-guarded.sh` from zsh too) and Linux.
#
# Usage: bash tools/build-guard/build-wechat-guarded.sh [wechat|web|both]      (default: wechat)
# Env:   CREATOR=/path/to/CocosCreator.app/Contents/MacOS/CocosCreator  (required; or a fake builder for tests)
#        MIN_BYTES=15000000  MAX_TRIES=3  KEEP_CACHE=0  LOG_DIR=<repo>/tools/build-guard/logs  SKIP_CREATOR_CHECK=0
#        NODE=node (needed for release gates)
# Probes (full9c): wechat RELEASE is built from a staged copy with /*QF_PROBE_BEGIN*/…/*QF_PROBE_END*/ regions stripped
#        (strip-probes.cjs), then gated: release-gates.cjs --probe-free and --size (MAX_TOTAL_BYTES=24641536 MAX_MAIN_BYTES=4000000).
#        STRIP_PROBES=1 is the default for wechat; STRIP_PROBES=0 = TEST build with probes (built in place, size/probe gates skipped).
#        FORMAL_RELEASE=1 (r5, Grok Bot option 2) = FORMAL release for 提交审核/正式版: also strips /*QF_TRIAL_BEGIN*/…/*QF_TRIAL_END*/
#        (the shared __qfPreTransition / ?qfPre= entry) and adds release-gates.cjs --formal-free. Default (0) = trial upload, unchanged.
#        QF_PREVIEW=1 (journal r6) = DEVICE-PREVIEW test build for a phone QR (WeChat DevTools 预览): needs STRIP_PROBES=0 and
#        FORMAL_RELEASE=0; builds from a staged copy where tools/build-guard/preview-flavor.cjs flips the probe-only QF_DEVICE_PREVIEW
#        flag (qfPre defaults to journal-sky-gated, day/night button on the journey book). Never a release; the production path refuses it.
#        web is always a test build (probes kept). Stage dir: QF_STAGE_ROOT (default $HOME/wt/qf-stage, must be outside the repo).
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=${REPO_ROOT:-$(cd "$HERE/../.." && pwd)}
P="$REPO/creator-build-project"
MIN_BYTES=${MIN_BYTES:-15000000}; MAX_TRIES=${MAX_TRIES:-3}; KEEP_CACHE=${KEEP_CACHE:-0}
LOG_DIR=${LOG_DIR:-$HERE/logs}; ERR_TEXT='当前初始场景不存在'
TARGET=${1:-wechat}
# Preload sizes (fg-preload-sizes): every good build is measured against the committed PRELOAD_BYTES block in TransitionChain.ts
# (tools/preload-size/preload-bytes.cjs --check, tolerance PRELOAD_TOL=0.02 = 2 %). Drift fails the build and prints the --write command.
PRELOAD_GATE=${PRELOAD_GATE:-1}; PRELOAD_TOL=${PRELOAD_TOL:-0.02}
NODE=${NODE:-node}; STRIP_PROBES=${STRIP_PROBES:-1}; FORMAL_RELEASE=${FORMAL_RELEASE:-0}; QF_STAGE_ROOT=${QF_STAGE_ROOT:-$HOME/wt/qf-stage}
MAX_TOTAL_BYTES=${MAX_TOTAL_BYTES:-24641536}; MAX_MAIN_BYTES=${MAX_MAIN_BYTES:-4000000}
die(){ echo; echo "################################################################"; echo "BUILD GUARD FAILED: $*"; echo "################################################################"; exit 2; }
if [ "$FORMAL_RELEASE" = 1 ] && [ "$STRIP_PROBES" != 1 ]; then echo "BUILD GUARD FAILED: FORMAL_RELEASE=1 needs STRIP_PROBES=1"; exit 2; fi
QF_PREVIEW=${QF_PREVIEW:-0}
if [ "$QF_PREVIEW" = 1 ] && { [ "$STRIP_PROBES" != 0 ] || [ "$FORMAL_RELEASE" != 0 ]; }; then echo "BUILD GUARD FAILED: QF_PREVIEW=1 is a test build (needs STRIP_PROBES=0 FORMAL_RELEASE=0)"; exit 2; fi
FORMAL_ARG=""; [ "$FORMAL_RELEASE" = 1 ] && FORMAL_ARG="--formal"
[ -n "${CREATOR:-}" ] || die "set CREATOR to the CocosCreator binary (…/CocosCreator.app/Contents/MacOS/CocosCreator)"
[ -x "$CREATOR" ] || die "CREATOR is not executable: $CREATOR"
[ -d "$P/assets" ] || die "no creator-build-project/assets under $REPO"
cd "$REPO" || die "cd $REPO"
mkdir -p "$LOG_DIR"
# Provenance (printed first, before any build): which commit/tree this guard output belongs to, and when (UTC).
GUARD_HEAD=$(git rev-parse HEAD 2>/dev/null || echo unknown); GUARD_TREE=$(git rev-parse 'HEAD^{tree}' 2>/dev/null || echo unknown)
GUARD_SHORT=$(git rev-parse --short=7 HEAD 2>/dev/null || echo nogit); GUARD_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "== GUARD HEAD=$GUARD_HEAD tree=$GUARD_TREE short=$GUARD_SHORT utc=$GUARD_UTC target=$TARGET"
# Untracked build products are fine; anything else in git status means the tree is not as committed.
dirty(){ git status --porcelain --untracked-files=all | grep -v -E '^\?\? creator-build-project/(build|library|temp|local|profiles)/' | grep -v -E '^\?\? tools/build-guard/logs/' ; }
bytes(){ [ -d "$1" ] || { echo 0; return; }; find "$1" -type f -exec wc -c {} + 2>/dev/null | awk '$2!="total"{s+=$1}END{print s+0}'; }
clean_cache(){ rm -rf "$P/library" "$P/temp"; }
restore_meta(){
  # tracked metas the importer rewrote, then metas it created that were never committed
  git diff --name-only -z -- '*.meta' | xargs -0 git checkout -- 2>/dev/null
  git ls-files --others --exclude-standard -z -- '*.meta' | xargs -0 rm -f 2>/dev/null
  true
}
if [ "$PRELOAD_GATE" = 1 ]; then "$NODE" -e 1 2>/dev/null || die "NODE ($NODE) not runnable; the preload-bytes gate needs node (PRELOAD_GATE=0 only for a throwaway build)"; fi
if [ "${SKIP_CREATOR_CHECK:-0}" != 1 ] && pgrep -f "MacOS/CocosCreator " >/dev/null 2>&1; then die "another Cocos Creator is running; close it first"; fi
if [ -n "$(dirty)" ]; then dirty | head -20; die "git tree is not clean before building (commit/stash first)"; fi
if { [ "$STRIP_PROBES" = 1 ] || [ "$QF_PREVIEW" = 1 ]; } && [ "$TARGET" != web ]; then
  "$NODE" -e 1 2>/dev/null || die "NODE ($NODE) not runnable; release gates need node (or STRIP_PROBES=0 for a test build)"
  case "$QF_STAGE_ROOT/" in "$REPO"/*) die "QF_STAGE_ROOT must be outside the repo: $QF_STAGE_ROOT";; esac
fi
# Stage a copy of the committed project (tracked files only; tree is clean so == HEAD) and strip probes there. Repo is never edited.
stage_release(){
  SP_ROOT="$QF_STAGE_ROOT/$GUARD_SHORT"; rm -rf "$SP_ROOT"; mkdir -p "$SP_ROOT" || die "mkdir $SP_ROOT"
  git ls-files -z creator-build-project | tar --null -T - -cf - | tar -x -C "$SP_ROOT" || die "staging copy failed"
  "$NODE" "$HERE/strip-probes.cjs" --stage "$SP_ROOT/creator-build-project" $FORMAL_ARG || die "strip-probes failed (unbalanced markers?)"
  "$NODE" "$HERE/strip-probes.cjs" --prove "$P" "$SP_ROOT/creator-build-project" --diff "$LOG_DIR/strip-probes.$GUARD_SHORT.diff" $FORMAL_ARG || die "strip proof failed"
  echo "   staged+stripped: $SP_ROOT/creator-build-project  diff=$LOG_DIR/strip-probes.$GUARD_SHORT.diff"
}
# journal r6 device preview: staged copy (probes kept) with the preview flag flipped. Repo is never edited.
stage_preview(){
  SP_ROOT="$QF_STAGE_ROOT/$GUARD_SHORT-preview"; rm -rf "$SP_ROOT"; mkdir -p "$SP_ROOT" || die "mkdir $SP_ROOT"
  git ls-files -z creator-build-project | tar --null -T - -cf - | tar -x -C "$SP_ROOT" || die "staging copy failed"
  "$NODE" "$HERE/preview-flavor.cjs" --stage "$SP_ROOT/creator-build-project" || die "preview-flavor failed"
  echo "   staged DEVICE PREVIEW: $SP_ROOT/creator-build-project"
}
# metas the importer rewrote/created in the stage (the stage has no git): compare with the repo
stage_dirty(){ (cd "$BP" && find assets -name '*.meta' -type f) | while read -r f; do cmp -s "$BP/$f" "$P/$f" || echo "$f"; done; }
# Pre-build gates (GGbot 2026-10-29): per-field .meta allowlist vs the base (META_ALLOWLIST_BASE or merge-base with
# ggbot/full9c-final) and manifest entries that point at files. Both need node; no node = no build.
NODE=${NODE:-node}; command -v "$NODE" >/dev/null 2>&1 || die "node not found (set NODE=/path/to/node); the meta-allowlist gate needs it"
gate(){ "$NODE" "$HERE/meta-allowlist.cjs" --root "$REPO" "$@" || die "meta-allowlist gate failed ${1:+($*)}"; "$NODE" "$HERE/manifest-files-exist.cjs" --root "$REPO" "$@" || die "manifest-files-exist gate failed ${1:+($*)}"; }
gate
outname(){ sed -n 's/.*"outputName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | head -1; }
build_one(){ # $1 = config json, $2 = 1 strip probes (release) / 0 test build
  cfg=$1; strip=${2:-0}; out=$(outname "$cfg"); [ -n "$out" ] || die "no outputName in $cfg"
  BP=$P; pv=0; [ "$QF_PREVIEW" = 1 ] && [ "$strip" = 0 ] && [ "$(basename "$cfg")" = wechat-release.json ] && pv=1
  if [ "$pv" = 1 ]; then stage_preview; BP="$SP_ROOT/creator-build-project"; echo "== [$out] DEVICE PREVIEW test build (probes kept, qfPre default journal-sky-gated, journal day/night button) - NOT a release"; elif [ "$strip" = 1 ]; then stage_release; BP="$SP_ROOT/creator-build-project"; if [ "$FORMAL_RELEASE" = 1 ]; then echo "== [$out] FORMAL RELEASE (probes + trial entry stripped)"; else echo "== [$out] RELEASE (probes stripped) = trial upload, qfPre trial entry kept"; fi; else echo "== [$out] TEST build: PROBES KEPT (not a release)"; fi
  dest="$BP/build/$out"; try=1
  while [ $try -le "$MAX_TRIES" ]; do
    # Log name carries the short SHA; the old name <out>.tryN.log stays as a symlink to it for existing readers.
    log="$LOG_DIR/$out.$GUARD_SHORT.try$try.log"; ln -sf "$(basename "$log")" "$LOG_DIR/$out.try$try.log"
    echo "== [$out] try $try/$MAX_TRIES  free=$(df -k "$REPO" | tail -1 | awk '{print $4}') KiB"
    clean_cache; rm -rf "$dest" "$BP/library" "$BP/temp"
    { echo "== GUARD HEAD=$GUARD_HEAD tree=$GUARD_TREE utc=$GUARD_UTC config=$cfg try=$try strip=$strip project=$BP"; "$CREATOR" --project "$BP" --build "configPath=$cfg"; } > "$log" 2>&1; code=$?
    size=$(bytes "$dest"); reason=""
    [ "$size" -gt "$MIN_BYTES" ] || reason="$reason size=$size<=$MIN_BYTES"
    if grep -q "$ERR_TEXT" "$log"; then reason="$reason log:'$ERR_TEXT'"; fi
    nd=$(dirty | wc -l | tr -d ' '); [ "$nd" = 0 ] || reason="$reason git-status:$nd-changed"
    if [ "$strip" = 1 ] || [ "$pv" = 1 ]; then sd=$(stage_dirty | wc -l | tr -d ' '); [ "$sd" = 0 ] || reason="$reason stage-meta:$sd-changed"; fi
    echo "   exit=$code size=$size dirty=$nd log=$log"
    if [ -z "$reason" ]; then
      echo "OK [$out] TOTAL_BYTES=$size"
      gate --build-dir "$dest"
      if [ -d "$dest/subpackages" ]; then
        echo "   ROOT $(find "$dest" -type f -not -path '*/subpackages/*' -exec wc -c {} + | awk '$2!="total"{s+=$1}END{print s+0}')"
        for d in "$dest"/subpackages/*; do [ -d "$d" ] && echo "   SUB $(basename "$d") $(bytes "$d")"; done
      fi
      if [ "$PRELOAD_GATE" = 1 ]; then
        "$NODE" "$REPO/tools/preload-size/preload-bytes.cjs" --check "$dest" --tol "$PRELOAD_TOL" --md "$LOG_DIR/preload-bytes.$out.$GUARD_SHORT.md" --json "$LOG_DIR/preload-bytes.$out.$GUARD_SHORT.json" \
          || die "[$out] PRELOAD_BYTES differ from the built bundles by > $PRELOAD_TOL (table: $LOG_DIR/preload-bytes.$out.$GUARD_SHORT.md)"
      fi
      if [ "$strip" = 1 ]; then
        "$NODE" "$HERE/release-gates.cjs" --probe-free "$dest" || die "[$out] RELEASE GATE: probe code in release output"
        if [ "$FORMAL_RELEASE" = 1 ]; then "$NODE" "$HERE/release-gates.cjs" --formal-free "$dest" || die "[$out] FORMAL RELEASE GATE: trial entry (qfPre) in formal release output"; fi
        "$NODE" "$HERE/release-gates.cjs" --size "$dest" --max-total "$MAX_TOTAL_BYTES" --max-main "$MAX_MAIN_BYTES" || die "[$out] RELEASE GATE: size"
        mkdir -p "$P/build"; rm -rf "$P/build/$out"; cp -R "$dest" "$P/build/$out" || die "copy release to $P/build/$out"
        rm -rf "$BP/library" "$BP/temp"; echo "   release copied to creator-build-project/build/$out (stage kept: $SP_ROOT)"
      fi
      if [ "$pv" = 1 ]; then
        "$NODE" "$HERE/preview-flavor.cjs" --check "$dest" || { kept="$P/build/$out-preview-FAILED"; rm -rf "$kept"; cp -R "$dest" "$kept" 2>/dev/null; die "[$out] DEVICE PREVIEW: flag not in the output (kept for inspection: output $kept, stage $SP_ROOT)"; }
        mkdir -p "$P/build"; rm -rf "$P/build/$out-preview"; cp -R "$dest" "$P/build/$out-preview" || die "copy preview to $P/build/$out-preview"
        rm -rf "$BP/library" "$BP/temp"; echo "   DEVICE PREVIEW copied to creator-build-project/build/$out-preview (stage kept: $SP_ROOT)"
      fi
      LAST_TOTAL=$size; return 0
    fi
    echo "   REJECTED:$reason -> restoring .meta, clearing library/temp, retrying"
    restore_meta; clean_cache; rm -rf "$dest"; [ "$strip" = 1 ] && stage_release >/dev/null; [ "$pv" = 1 ] && stage_preview >/dev/null
    try=$((try+1))
  done
  restore_meta; clean_cache
  [ -z "$(dirty)" ] || { dirty | head; echo "WARNING: tree still not clean after restore"; }
  die "[$out] no good build after $MAX_TRIES tries (logs in $LOG_DIR)"
}
SUMMARY=""
case "$TARGET" in
  wechat) build_one "$HERE/wechat-release.json" "$STRIP_PROBES"; SUMMARY="wechat-release $LAST_TOTAL (strip=$STRIP_PROBES)";;
  web)    build_one "$HERE/web-test.json" 0; SUMMARY="web-test $LAST_TOTAL (probes)";;
  both)   build_one "$HERE/wechat-release.json" "$STRIP_PROBES"; SUMMARY="wechat-release $LAST_TOTAL (strip=$STRIP_PROBES)"; build_one "$HERE/web-test.json" 0; SUMMARY="$SUMMARY | web-test $LAST_TOTAL (probes)";;
  *) die "target must be wechat, web or both";;
esac
# system-panels SPEC §1.4: authoritative artifact scan (build/wechatgame/**, literal + \u-escaped); any hit fails the build.
if [ -f "$HERE/check-no-placeholder.cjs" ] && command -v node >/dev/null 2>&1; then node "$HERE/check-no-placeholder.cjs" --root "$HERE/../.." || die "placeholder word found in source/build output"; fi
if [ "$KEEP_CACHE" != 1 ]; then clean_cache; echo "caches removed (library/temp); set KEEP_CACHE=1 to keep"; fi
[ "$FORMAL_RELEASE" = 1 ] || [ "$TARGET" = web ] || echo "NOTE: not a production build (FORMAL_RELEASE=0, trial entry kept) - production uploads use tools/build-guard/build-production-upload.sh (FORMAL_RELEASE=1)"
echo "BUILD GUARD PASSED: $SUMMARY  (output under creator-build-project/build/)  HEAD=$GUARD_SHORT tree=$GUARD_TREE"
