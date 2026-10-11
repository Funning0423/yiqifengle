#!/usr/bin/env bash
# T6 cheer-text offline tests: transpile real sources with pinned tsc, alias cc/GameAudio/board to stubs, run.
set -euo pipefail
H=$(cd "$(dirname "$0")" && pwd); P=$H/../../../creator-build-project/assets/scripts; NM=${NM:-/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules}
rm -rf "$H/out"; mkdir -p "$H/out/ui"
for f in CheerTextModel CheerText; do node -e "const ts=require('$NM/typescript');const fs=require('fs');const o=ts.transpileModule(fs.readFileSync('$P/ui/$f.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2015,experimentalDecorators:true}}).outputText.replace(/from '..\/audio\/GameAudio'/,\"from '../../gameaudio-stub.mjs'\").replace(/from '..\/ManagedMobileBoardUI'/,\"from '../../board-stub.mjs'\").replace(/from '.\/CheerTextModel'/,\"from './CheerTextModel.js'\");fs.writeFileSync('$H/out/ui/$f.js',o)"; done
mkdir -p "$H/node_modules/cc"; cp "$H/cc-stub.mjs" "$H/node_modules/cc/index.mjs"; echo '{"name":"cc","type":"module","exports":"./index.mjs"}' > "$H/node_modules/cc/package.json"
echo '{"type":"module"}' > "$H/out/package.json"; cd "$H" && node t6.test.mjs && node t6b-bitmap.test.mjs
