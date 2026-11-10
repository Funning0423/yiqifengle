#!/usr/bin/env bash
# E1 build guard: Creator 3.8.8 CLI builds fail asset import ~1 in 2 (asset-db "ready" with nothing imported). Such a run
# gives a ~2.3 MB package, logs 「当前初始场景不存在」 and rewrites ~400 .meta files to importer "*". This wrapper only passes a
# build that is > MIN_BYTES, has no such error and leaves `git status --porcelain` empty; otherwise it restores the metas,
# drops library/temp and retries (MAX_TRIES), then fails loudly. Caches are removed afterwards (the Mac disk is tight).
# Works with macOS /bin/bash 3.2 (run it as `bash tools/build-guard/build-wechat-guarded.sh` from zsh too) and Linux.
#
# Known Creator 3.8.8 rewrite at baseline 95dc672d: transport_balloon.glb.meta only. The committed importer
# ver is 2.3.14 (gltf), the same as sibling balloon/sail glbs Creator leaves alone; sub-importer versions match
# too (gltf-mesh 1.1.1, gltf-material 1.0.14, texture 1.0.22, gltf-embeded-image 1.0.3, gltf-scene 1.0.14).
# The version is not stale. Commit 6f7109b1 hand-added subMeta id a4c17 for balloon_load_frame.mesh (triangle
# counts already match the glb: basket 324, frame 221). A Mac reimport replaces a4c17 with c9dd7, so /subMetas,
# that sub-asset uuid and /userData/assetFinder/meshes change. This wrapper records balloon-file hashes before
# the build; if that meta is the only balloon or git/stage change, it git-checkouts the committed bytes, checks
# the hash against the pre-build baseline, logs one WARN and continues. A glb, texture, material or any other
# balloon file change is still a reject. No other gate is relaxed.
#
# Usage: bash tools/build-guard/build-wechat-guarded.sh [wechat|web|both]      (default: wechat)
# Env:   CREATOR=/path/to/CocosCreator.app/Contents/MacOS/CocosCreator  (required; or a fake builder for tests)
#        MIN_BYTES=15000000  MAX_TRIES=3  KEEP_CACHE=0  LOG_DIR=<repo>/tools/build-guard/logs  SKIP_CREATOR_CHECK=0
#        NODE=node (needed for release gates)
#        META_ALLOWLIST_BASE=<ref>  optional meta-allowlist diff base, used as given (--base on the node gate wins).
#        Unset: merge-base HEAD origin/gbt/r5-b20-integrate-landing-visual-bg2, else that local branch, else 95dc672d.
#        The node gate prints which of those was chosen. Unknown .meta changes vs the chosen base still fail.
# Probes (full9c): wechat RELEASE is built from a staged copy with /*QF_PROBE_BEGIN*/…/*QF_PROBE_END*/ regions stripped
#        (strip-probes.cjs), then gated: release-gates.cjs --probe-free and --size (MAX_TOTAL_BYTES=24641536 MAX_MAIN_BYTES=4000000).
#        STRIP_PROBES=1 is the default for wechat; STRIP_PROBES=0 = TEST build with probes (built in place, size/probe gates skipped).
#        FORMAL_RELEASE=1 (r5, Grok Bot option 2) = FORMAL release for 提交审核/正式版: also strips /*QF_TRIAL_BEGIN*/…/*QF_TRIAL_END*/
#        (the shared __qfPreTransition / ?qfPre= entry) and adds release-gates.cjs --formal-free. Default (0) = trial upload, unchanged.
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
# Balloon assets frozen at the pre-build tree. bash 3.2: no associative arrays; the record is a TSV of blob hashes.
BALLOON_DIR=creator-build-project/assets/bundles/region_transit_balloon
KNOWN_META=$BALLOON_DIR/transport_balloon.glb.meta
KNOWN_STAGE_META=assets/bundles/region_transit_balloon/transport_balloon.glb.meta
record_balloon_hashes(){
  BALLOON_BASE=$LOG_DIR/balloon-base.$GUARD_SHORT.tsv
  : > "$BALLOON_BASE"
  git ls-files -z -- "$BALLOON_DIR" | while IFS= read -r -d '' f; do
    printf '%s\t%s\n' "$(git hash-object -- "$f")" "$f"
  done > "$BALLOON_BASE"
  if [ -f "$KNOWN_META" ]; then BALLOON_META_HASH=$(git hash-object -- "$KNOWN_META"); else BALLOON_META_HASH=""; fi
}
# Repo-relative paths whose blob no longer matches the pre-build record.
balloon_repo_drift(){
  [ -f "${BALLOON_BASE:-}" ] || return 0
  while IFS=$'\t' read -r h f; do
    [ -n "${f:-}" ] || continue
    if [ ! -f "$f" ]; then echo "$f"; continue; fi
    nh=$(git hash-object -- "$f"); [ "$nh" = "$h" ] || echo "$f"
  done < "$BALLOON_BASE"
}
# Stage paths (assets/...) whose blob no longer matches. $1 = staged creator-build-project.
balloon_stage_drift(){
  [ -f "${BALLOON_BASE:-}" ] || return 0
  root=$1
  while IFS=$'\t' read -r h f; do
    [ -n "${f:-}" ] || continue
    rel=${f#creator-build-project/}; sf=$root/$rel
    if [ ! -f "$sf" ]; then echo "$rel"; continue; fi
    nh=$(git hash-object -- "$sf"); [ "$nh" = "$h" ] || echo "$rel"
  done < "$BALLOON_BASE"
}
dirty_paths(){
  dirty | while IFS= read -r line; do
    [ -n "$line" ] || continue
    rest=${line#???}
    case "$rest" in
      *" -> "*) printf '%s\n' "${rest##* -> }";;
      *) printf '%s\n' "$rest";;
    esac
  done
}
restore_balloon_drift(){
  balloon_repo_drift | while IFS= read -r f; do
    [ -n "$f" ] || continue
    git checkout -- "$f" 2>/dev/null || echo "WARNING: could not restore $f"
  done
  true
}
# $1 = try number. Caller has already decided the known meta is the only drift.
accept_known_balloon_meta(){
  dif=$LOG_DIR/balloon-meta.$GUARD_SHORT.try$1.diff
  : > "$dif"
  git diff -- "$KNOWN_META" >> "$dif" 2>/dev/null || true
  if [ "${2:-}" = 1 ] && [ -n "${BP:-}" ] && [ -f "$BP/$KNOWN_STAGE_META" ]; then
    diff -u "$KNOWN_META" "$BP/$KNOWN_STAGE_META" >> "$dif" 2>/dev/null || true
  fi
  git checkout -- "$KNOWN_META" || die "git checkout $KNOWN_META failed"
  nh=$(git hash-object -- "$KNOWN_META")
  [ -n "${BALLOON_META_HASH:-}" ] || die "no pre-build hash for $KNOWN_META"
  [ "$nh" = "$BALLOON_META_HASH" ] || die "restored $KNOWN_META hash $nh != pre-build baseline $BALLOON_META_HASH"
  echo "WARN: Creator rewrote only $KNOWN_META (known Creator 3.8.8 reimport: hand-authored subMeta a4c17 -> c9dd7, so /subMetas, that sub-asset uuid and /userData/assetFinder/meshes change; importer ver stays 2.3.14, the same as sibling glTFs, so the committed meta version is not stale). git checkout restored it; hash $nh matches the pre-build baseline. diff=$dif"
}
if [ "$PRELOAD_GATE" = 1 ]; then "$NODE" -e 1 2>/dev/null || die "NODE ($NODE) not runnable; the preload-bytes gate needs node (PRELOAD_GATE=0 only for a throwaway build)"; fi
if [ "${SKIP_CREATOR_CHECK:-0}" != 1 ] && pgrep -f "MacOS/CocosCreator " >/dev/null 2>&1; then die "another Cocos Creator is running; close it first"; fi
if [ -n "$(dirty)" ]; then dirty | head -20; die "git tree is not clean before building (commit/stash first)"; fi
if [ "$STRIP_PROBES" = 1 ] && [ "$TARGET" != web ]; then
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
# metas the importer rewrote/created in the stage (the stage has no git): compare with the repo
stage_dirty(){ (cd "$BP" && find assets -name '*.meta' -type f) | while read -r f; do cmp -s "$BP/$f" "$P/$f" || echo "$f"; done; }
# Pre-build gates (GGbot 2026-10-29): per-field .meta allowlist vs the base, and manifest entries that point at files.
# Base: META_ALLOWLIST_BASE or --base if set (used as given). Otherwise meta-allowlist.cjs prints the base it chose:
# merge-base HEAD origin/gbt/r5-b20-integrate-landing-visual-bg2, else the local branch of that name, else 95dc672d.
# Both gates need node; no node = no build. Unknown .meta changes vs that base still fail. The balloon auto-restore is unchanged.
NODE=${NODE:-node}; command -v "$NODE" >/dev/null 2>&1 || die "node not found (set NODE=/path/to/node); the meta-allowlist gate needs it"
gate(){ "$NODE" "$HERE/meta-allowlist.cjs" --root "$REPO" "$@" || die "meta-allowlist gate failed ${1:+($*)}"; "$NODE" "$HERE/manifest-files-exist.cjs" --root "$REPO" "$@" || die "manifest-files-exist gate failed ${1:+($*)}"; }
gate
outname(){ sed -n 's/.*"outputName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | head -1; }
build_one(){ # $1 = config json, $2 = 1 strip probes (release) / 0 test build
  cfg=$1; strip=${2:-0}; out=$(outname "$cfg"); [ -n "$out" ] || die "no outputName in $cfg"
  BP=$P; if [ "$strip" = 1 ]; then stage_release; BP="$SP_ROOT/creator-build-project"; if [ "$FORMAL_RELEASE" = 1 ]; then echo "== [$out] FORMAL RELEASE (probes + trial entry stripped)"; else echo "== [$out] RELEASE (probes stripped) = trial upload, qfPre trial entry kept"; fi; else echo "== [$out] TEST build: PROBES KEPT (not a release)"; fi
  dest="$BP/build/$out"; try=1
  record_balloon_hashes
  while [ $try -le "$MAX_TRIES" ]; do
    # Log name carries the short SHA; the old name <out>.tryN.log stays as a symlink to it for existing readers.
    log="$LOG_DIR/$out.$GUARD_SHORT.try$try.log"; ln -sf "$(basename "$log")" "$LOG_DIR/$out.try$try.log"
    echo "== [$out] try $try/$MAX_TRIES  free=$(df -k "$REPO" | tail -1 | awk '{print $4}') KiB"
    clean_cache; rm -rf "$dest" "$BP/library" "$BP/temp"
    { echo "== GUARD HEAD=$GUARD_HEAD tree=$GUARD_TREE utc=$GUARD_UTC config=$cfg try=$try strip=$strip project=$BP"; "$CREATOR" --project "$BP" --build "configPath=$cfg"; } > "$log" 2>&1; code=$?
    size=$(bytes "$dest"); reason=""
    [ "$size" -gt "$MIN_BYTES" ] || reason="$reason size=$size<=$MIN_BYTES"
    if grep -q "$ERR_TEXT" "$log"; then reason="$reason log:'$ERR_TEXT'"; fi
    repo_drift=$(balloon_repo_drift)
    repo_other=$(printf '%s\n' "$repo_drift" | grep -vx "$KNOWN_META" | grep -v '^$' || true)
    repo_meta=$(printf '%s\n' "$repo_drift" | grep -x "$KNOWN_META" || true)
    paths=$(dirty_paths)
    dirty_other=$(printf '%s\n' "$paths" | grep -vx "$KNOWN_META" | grep -v '^$' || true)
    dirty_meta=$(printf '%s\n' "$paths" | grep -x "$KNOWN_META" || true)
    stage_other=""; stage_meta=""; stage_meta_other=""; sml=""; sd=0
    if [ "$strip" = 1 ]; then
      stage_drift=$(balloon_stage_drift "$BP")
      stage_other=$(printf '%s\n' "$stage_drift" | grep -vx "$KNOWN_STAGE_META" | grep -v '^$' || true)
      stage_meta=$(printf '%s\n' "$stage_drift" | grep -x "$KNOWN_STAGE_META" || true)
      # Keep the names AND copies of the stage metas Creator rewrote/created before any stage cleanup (e318bdd2 lost them).
      sml="$LOG_DIR/stage-meta.$GUARD_SHORT.try$try.txt"; stage_dirty > "$sml"; sd=$(wc -l < "$sml" | tr -d ' ')
      stage_meta_other=$(grep -vx "$KNOWN_STAGE_META" "$sml" || true)
    fi
    known_only=0
    if [ -z "$repo_other" ] && [ -z "$dirty_other" ] && [ -z "$stage_other" ] && [ -z "$stage_meta_other" ]; then
      if [ -n "$repo_meta$dirty_meta$stage_meta" ]; then known_only=1; fi
    fi
    if [ "$known_only" != 1 ]; then
      nd=$(printf '%s\n' "$paths" | grep -v '^$' | wc -l | tr -d ' ')
      [ "$nd" = 0 ] || reason="$reason git-status:$nd-changed"
      if [ -n "$repo_other$stage_other" ]; then
        bf=$(printf '%s\n%s\n' "$repo_other" "$stage_other" | grep -v '^$' | tr '\n' ',' || true)
        reason="$reason balloon-file:$bf"
        echo "   balloon files changed (not the known meta): $bf"
      fi
      if [ "$strip" = 1 ] && [ "$sd" != 0 ]; then
        smd="$LOG_DIR/stage-meta.$GUARD_SHORT.try$try"; rm -rf "$smd"
        while read -r f; do mkdir -p "$smd/$(dirname "$f")"; cp -p "$BP/$f" "$smd/$f"; done < "$sml"
        reason="$reason stage-meta:$sd-changed"; echo "   stage-meta changed ($sd), list=$sml copies=$smd:"; sed 's/^/     /' "$sml"
      fi
    else
      nd=0
    fi
    echo "   exit=$code size=$size dirty=$nd log=$log"
    if [ -z "$reason" ]; then
      if [ "$known_only" = 1 ]; then accept_known_balloon_meta "$try" "$strip"; fi
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
      LAST_TOTAL=$size; return 0
    fi
    echo "   REJECTED:$reason -> restoring .meta, clearing library/temp, retrying"
    restore_meta; restore_balloon_drift; clean_cache; rm -rf "$dest"; [ "$strip" = 1 ] && stage_release >/dev/null
    try=$((try+1))
  done
  restore_meta; restore_balloon_drift; clean_cache
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
