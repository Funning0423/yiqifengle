#!/usr/bin/env bash
# full8: commit the Creator-generated .meta of the two 场景设计部 glbs BEFORE tools/build-guard/build-wechat-guarded.sh
# (the guard rejects any untracked/changed .meta and deletes it). Run on the Mac after opening the project in Creator 3.8.8
# once (Assets panel finishes importing far_meadow_impostor.glb + sea_reef_cluster.glb), then close Creator.
# Refuses if anything other than those two assets' metas changed. Never hand-write these metas.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
D=creator-build-project/assets/bundles/transport_sail
want='^creator-build-project/assets/bundles/transport_sail/(far_meadow_impostor|sea_reef_cluster)(\.glb\.meta|/.*\.meta|\.meta)$'
new=$(git ls-files --others --exclude-standard -- '*.meta')
chg=$(git diff --name-only -- '*.meta')
bad=$(printf '%s\n%s\n' "$new" "$chg" | grep -v '^$' | grep -v -E "$want" || true)
if [ -n "$bad" ]; then echo "REFUSED: other .meta changed (importer rewrote them?):"; echo "$bad" | head -20; echo "fix: git checkout -- <those>; reopen Creator"; exit 1; fi
for a in far_meadow_impostor sea_reef_cluster; do [ -f "$D/$a.glb.meta" ] || { echo "REFUSED: $D/$a.glb.meta missing — let Creator finish importing"; exit 1; }; done
grep -q '"importer": *"gltf"' "$D/far_meadow_impostor.glb.meta" && grep -q '"importer": *"gltf"' "$D/sea_reef_cluster.glb.meta" || { echo 'REFUSED: importer is not "gltf"'; exit 1; }
git add -- $(printf '%s\n' "$new" | grep -E "$want")
git -c user.name="Cursor Agent" -c user.email=cursoragent@cursor.com commit -m "full8: Creator import metas for far_meadow_impostor / sea_reef_cluster"
echo "OK — now: bash tools/build-guard/build-wechat-guarded.sh"
