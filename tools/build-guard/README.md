# build-guard

Creator build wrapper and the pre-build gates it runs. The scripts' headers are the behavior spec; this file records the meta-allowlist base and the balloon exception that must stay strict.

## meta-allowlist base

`node tools/build-guard/meta-allowlist.cjs` diffs every changed `.meta` against one base commit.

When `--base` and `META_ALLOWLIST_BASE` are both unset, the base is chosen in this order:

1. `git merge-base HEAD origin/gbt/r5-b20-integrate-landing-visual-bg2`
2. `git merge-base HEAD gbt/r5-b20-integrate-landing-visual-bg2` if that remote ref does not resolve (or merge-base with it fails)
3. commit `95dc672d` if neither ref resolves

The gate prints the choice, for example:

```
INFO base chosen: merge-base HEAD origin/gbt/r5-b20-integrate-landing-visual-bg2 -> <sha>
```

`META_ALLOWLIST_BASE` is used as the diff base exactly as given. `--base` wins over the env var and is also used as given. Neither is passed through `merge-base`.

`meta-allowlist.json` still has `"baseRef": "ggbot/full9c-final"` for other readers. This gate reads its base only from `--base`, `META_ALLOWLIST_BASE`, and the three-step default above. That old ref is not on the box or the Mac, and using it made every run `NO_BASE`.

A `.meta` change that is not an exact allow rule still fails (`NOT_ALLOWED`, `META_ADDED`, `META_DELETED`, `UUID_CHANGED`, `NEEDS_REVIEW`). The integration-branch default skips metas that branch already contains. A meta this working tree adds or edits on top of that base still fails.

## Balloon meta

`build-wechat-guarded.sh` may `git checkout` `transport_balloon.glb.meta` after a Creator 3.8.8 reimport when that file is the only balloon, git, or stage change, then checks the restored blob against the pre-build hash. A `.glb`, texture, material, or any other balloon file change still rejects the build.

Separately, a balloon `.meta` whose working-tree blob is identical to `META_BALLOON_BASELINE` (default `95dc672d`) is not counted as a change. A balloon meta that differs from that pin is still judged against the chosen base.

## Scan root

`build-wechat-guarded.sh` and the gates it runs (meta allowlist, manifest files, placeholder, and the other scanners under `tools/build-guard/`) take their repo root from `REPO_ROOT` when that is set, otherwise from `git rev-parse --show-toplevel` of the current directory. The directory that contains the script is not the root, so a copy of the guard outside the worktree still scans the repo you launched it from.

A check that scans zero targets fails. That includes a placeholder run with no directories or text files, a meta allowlist with no `.meta` files, a manifest with no entries, a release gate with no build files, and the other scanners with nothing to read.

## Tests

```
node tools/build-guard/test_meta_gates.cjs
bash tools/build-guard/test_build_guard.sh
```
