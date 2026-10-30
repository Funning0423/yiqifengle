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
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=${REPO_ROOT:-$(cd "$HERE/../.." && pwd)}
P="$REPO/creator-build-project"
MIN_BYTES=${MIN_BYTES:-15000000}; MAX_TRIES=${MAX_TRIES:-3}; KEEP_CACHE=${KEEP_CACHE:-0}
LOG_DIR=${LOG_DIR:-$HERE/logs}; ERR_TEXT='当前初始场景不存在'
TARGET=${1:-wechat}
die(){ echo; echo "################################################################"; echo "BUILD GUARD FAILED: $*"; echo "################################################################"; exit 2; }
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
if [ "${SKIP_CREATOR_CHECK:-0}" != 1 ] && pgrep -f "MacOS/CocosCreator " >/dev/null 2>&1; then die "another Cocos Creator is running; close it first"; fi
if [ -n "$(dirty)" ]; then dirty | head -20; die "git tree is not clean before building (commit/stash first)"; fi
# Pre-build gates (GGbot 2026-10-29): per-field .meta allowlist vs the base (META_ALLOWLIST_BASE or merge-base with
# ggbot/full9c-final) and manifest entries that point at files. Both need node; no node = no build.
NODE=${NODE:-node}; command -v "$NODE" >/dev/null 2>&1 || die "node not found (set NODE=/path/to/node); the meta-allowlist gate needs it"
gate(){ "$NODE" "$HERE/meta-allowlist.cjs" --root "$REPO" "$@" || die "meta-allowlist gate failed ${1:+($*)}"; "$NODE" "$HERE/manifest-files-exist.cjs" --root "$REPO" "$@" || die "manifest-files-exist gate failed ${1:+($*)}"; }
gate
outname(){ sed -n 's/.*"outputName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | head -1; }
build_one(){ # $1 = config json
  cfg=$1; out=$(outname "$cfg"); [ -n "$out" ] || die "no outputName in $cfg"
  dest="$P/build/$out"; try=1
  while [ $try -le "$MAX_TRIES" ]; do
    # Log name carries the short SHA; the old name <out>.tryN.log stays as a symlink to it for existing readers.
    log="$LOG_DIR/$out.$GUARD_SHORT.try$try.log"; ln -sf "$(basename "$log")" "$LOG_DIR/$out.try$try.log"
    echo "== [$out] try $try/$MAX_TRIES  free=$(df -k "$REPO" | tail -1 | awk '{print $4}') KiB"
    clean_cache; rm -rf "$dest"
    { echo "== GUARD HEAD=$GUARD_HEAD tree=$GUARD_TREE utc=$GUARD_UTC config=$cfg try=$try"; "$CREATOR" --project "$P" --build "configPath=$cfg"; } > "$log" 2>&1; code=$?
    size=$(bytes "$dest"); reason=""
    [ "$size" -gt "$MIN_BYTES" ] || reason="$reason size=$size<=$MIN_BYTES"
    if grep -q "$ERR_TEXT" "$log"; then reason="$reason log:'$ERR_TEXT'"; fi
    nd=$(dirty | wc -l | tr -d ' '); [ "$nd" = 0 ] || reason="$reason git-status:$nd-changed"
    echo "   exit=$code size=$size dirty=$nd log=$log"
    if [ -z "$reason" ]; then
      echo "OK [$out] TOTAL_BYTES=$size"
      gate --build-dir "$dest"
      if [ -d "$dest/subpackages" ]; then
        echo "   ROOT $(find "$dest" -type f -not -path '*/subpackages/*' -exec wc -c {} + | awk '$2!="total"{s+=$1}END{print s+0}')"
        for d in "$dest"/subpackages/*; do [ -d "$d" ] && echo "   SUB $(basename "$d") $(bytes "$d")"; done
      fi
      LAST_TOTAL=$size; return 0
    fi
    echo "   REJECTED:$reason -> restoring .meta, clearing library/temp, retrying"
    restore_meta; clean_cache; rm -rf "$dest"
    try=$((try+1))
  done
  restore_meta; clean_cache
  [ -z "$(dirty)" ] || { dirty | head; echo "WARNING: tree still not clean after restore"; }
  die "[$out] no good build after $MAX_TRIES tries (logs in $LOG_DIR)"
}
SUMMARY=""
case "$TARGET" in
  wechat) build_one "$HERE/wechat-release.json"; SUMMARY="wechat-release $LAST_TOTAL";;
  web)    build_one "$HERE/web-test.json"; SUMMARY="web-test $LAST_TOTAL";;
  both)   build_one "$HERE/wechat-release.json"; SUMMARY="wechat-release $LAST_TOTAL"; build_one "$HERE/web-test.json"; SUMMARY="$SUMMARY | web-test $LAST_TOTAL";;
  *) die "target must be wechat, web or both";;
esac
if [ "$KEEP_CACHE" != 1 ]; then clean_cache; echo "caches removed (library/temp); set KEEP_CACHE=1 to keep"; fi
echo "BUILD GUARD PASSED: $SUMMARY bytes  (output under creator-build-project/build/)  HEAD=$GUARD_SHORT tree=$GUARD_TREE"
