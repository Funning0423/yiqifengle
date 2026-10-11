#!/usr/bin/env bash
# Usage: tools/grokbot-autoplay/test/build_and_run.sh [T1_DIR]
# Needs node>=18 and esbuild@0.21.5 (GB_TOOLS=<dir with node_modules/esbuild>, default /tmp/gb-t0-tools).
# T1_DIR (optional) = extracted T1-lighthouse-return-baseline package; enables the T1 touch/return tests against the REAL T1 code.
# GB_INT_DIR (optional env) = checkout of int/v1 (5d66c30 or newer; dir containing creator-build-project/); enables autoplay=combo
#   integration tests against the REAL int/v1 audio/GameAudio.ts + ui/CheerText.ts (+CheerTextModel). Without it they are SKIPPED.
set -euo pipefail
export GB_PRELUDE_FILE="$(cd "$(dirname "$0")/.." && pwd)/prelude/gb-touch-prelude.js"
here="$(cd "$(dirname "$0")" && pwd)"; tools="${GB_TOOLS:-/tmp/gb-t0-tools}"; out="$(mktemp -d)"; t1="${1:-}"
scripts="$here/../../../creator-build-project/assets/scripts"
NODE_PATH="$tools/node_modules" node - "$here" "$out" "$scripts" "$t1" "${GB_INT_DIR:-}" <<'JS'
const [here,out,scripts,t1,intDir]=process.argv.slice(2);const path=require('path');const esbuild=require('esbuild');
const mk=(entry,file,overlay,home)=>({entryPoints:[path.join(here,entry)],outfile:path.join(out,file),bundle:true,platform:'node',format:'esm',target:'node18',logLevel:'error',
 alias:{cc:path.join(here,'cc-stub.mjs'),'cc/env':path.join(here,'cc-env-stub.mjs')},
 plugins:[{name:'stubs',setup(b){b.onResolve({filter:/(^|\/)(WarmButton|JourneyNavigationSkin)$/},()=>({path:path.join(here,'ui-stubs.mjs')}));b.onResolve({filter:/(^|\/)audio\/GameAudio$/},()=>({path:path.join(here,'gameaudio-stub.mjs')}));
  b.onResolve({filter:/^#overlay$/},()=>({path:overlay}));b.onResolve({filter:/^#home$/},()=>({path:home}));b.onResolve({filter:/^#board$/},()=>({path:path.join(here,'board-stub.mjs')}));
  b.onResolve({filter:/^#(gameaudio|cheertext)$/},()=>({path:path.join(here,'empty.mjs')}));}}]});
/** combo job: REAL int/v1 GameAudio + CheerText (ccclass decorators), ManagedMobileBoardUI -> board stub; nothing else redirected to fakes. */
const mkCombo=(entry,file,intScripts)=>({entryPoints:[path.join(here,entry)],outfile:path.join(out,file),bundle:true,platform:'node',format:'esm',target:'node18',logLevel:'error',
 tsconfigRaw:{compilerOptions:{experimentalDecorators:true}},alias:{cc:path.join(here,'cc-stub.mjs'),'cc/env':path.join(here,'cc-env-stub.mjs')},
 plugins:[{name:'combo',setup(b){b.onResolve({filter:/(^|\/)(WarmButton|JourneyNavigationSkin)$/},()=>({path:path.join(here,'ui-stubs.mjs')}));
  b.onResolve({filter:/(^|\/)ManagedMobileBoardUI$/},()=>({path:path.join(here,'board-stub.mjs')}));b.onResolve({filter:/^#board$/},()=>({path:path.join(here,'board-stub.mjs')}));
  b.onResolve({filter:/^#overlay$/},()=>({path:path.join(scripts,'world-r2/IslandJourneyOverlay.ts')}));b.onResolve({filter:/^#home$/},()=>({path:path.join(here,'empty.mjs')}));
  b.onResolve({filter:/^#gameaudio$/},()=>({path:path.join(intScripts,'audio/GameAudio.ts')}));b.onResolve({filter:/^#cheertext$/},()=>({path:path.join(intScripts,'ui/CheerText.ts')}));}}]});
const base=[path.join(scripts,'world-r2/IslandJourneyOverlay.ts'),path.join(here,'empty.mjs')];
const jobs=[esbuild.build(mk('combo.test.ts','combounit.mjs',...base)),esbuild.build(mk('sequencer.test.ts','sequencer.mjs',...base)),esbuild.build(mk('touch.test.ts','touchunit.mjs',...base)),esbuild.build(mk('integration.ts','int-base.mjs',...base)),esbuild.build(mk('integration-touch.ts','touch-base.mjs',...base))];
if(t1)for(const v of ['l123','l12']){const a=path.join(t1,'variants/baseline-'+v+'/after/creator-build-project/assets/scripts');const o=path.join(a,'world-r2/IslandJourneyOverlay.ts'),h=path.join(a,'world-r2/IslandHomeInteraction.ts');
 jobs.push(esbuild.build(mk('integration.ts','int-'+v+'.mjs',o,h)),esbuild.build(mk('integration-touch.ts','touch-'+v+'.mjs',o,h)));}
if(intDir)jobs.push(esbuild.build(mkCombo('integration-combo.ts','int-combo.mjs',path.join(intDir,'creator-build-project/assets/scripts'))));
Promise.all(jobs).catch(e=>{console.error(e);process.exit(1);});
JS
r(){ local name="$1"; shift; if env "$@" > "$out/$name.log" 2>&1; then tail -1 "$out/$name.log"; else echo "FAILED: $name"; grep -m3 "^FAIL" "$out/$name.log"; exit 1; fi; }
r unit-seq node "$out/sequencer.mjs"
r unit-touch node "$out/touchunit.mjs"
r unit-combo node "$out/combounit.mjs"
r oab-visible GB_DOOR_VISIBLE=visible node "$out/int-base.mjs"
r oab-hidden GB_DOOR_VISIBLE=hidden node "$out/int-base.mjs"
r oab-drag GB_DOOR_VISIBLE=reveal-by-drag GB_QUERY='?autoplay=out-and-back&gbDoor=drag' node "$out/int-base.mjs"
r oab-camhook GB_CAMERA_HOOK=1 node "$out/int-base.mjs"
r touch-noT1 GB_QUERY='?autoplay=touch&gbScenario=t1' node "$out/touch-base.mjs"
if GB_QUERY='?autoplay=off' node "$out/int-base.mjs" >"$out/off.log" 2>&1; then echo "FAIL: autoplay=off still ran"; exit 1; fi
grep -q 'GB_MARK autoplay-disabled 0' "$out/off.log" && echo "PASS autoplay=off: nothing armed, no observers"
if [ -n "$t1" ]; then
  r oab-t1-l123 GB_T1=l123 node "$out/int-l123.mjs"
  r touch-t1-l123 GB_T1=l123 GB_QUERY='?autoplay=touch&gbScenario=t1' node "$out/touch-l123.mjs"
  r touch-t1-l12 GB_T1=l12 GB_QUERY='?autoplay=touch&gbScenario=t1&gbVariant=l12' node "$out/touch-l12.mjs"
  r export-l123 GB_T1=l123 GB_EXPORT=1 GB_QUERY='?autoplay=touch&gbScenario=t1&gbExport=only' node "$out/touch-l123.mjs"
  # negative control via a custom JSON scenario on an inert test button: L3 (l123) must hold, l12 must show its known same-frame limitation
  r neg-l123 GB_T1=l123 GB_INERT_BUTTON=1 GB_QUERY='?autoplay=touch&gbScenario=neg-same-frame-inert' node "$out/touch-l123.mjs"
  r neg-l12 GB_T1=l12 GB_INERT_BUTTON=1 GB_QUERY='?autoplay=touch&gbScenario=neg-same-frame-inert&gbVariant=l12' node "$out/touch-l12.mjs"
  if GB_T1=l12 GB_INERT_BUTTON=1 GB_QUERY='?autoplay=touch&gbScenario=neg-same-frame-inert' node "$out/touch-l12.mjs" >"$out/neg.log" 2>&1; then echo "FAIL: l12 judged as l123 passed"; exit 1; fi
  grep -q '"actual":"return","verdict":"FAIL"' "$out/neg.log" && echo "PASS negative control: l12 judged with l123 expectation -> FAIL (runner discriminates L3)"
fi
if [ -n "${GB_INT_DIR:-}" ]; then
  IS="$GB_INT_DIR/creator-build-project/assets/scripts"; sh(){ if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -c1-64; else shasum -a 256 "$1" | cut -c1-64; fi; }
  echo "combo against REAL int/v1 sources: GameAudio $(sh "$IS/audio/GameAudio.ts" | cut -c1-8) CheerText $(sh "$IS/ui/CheerText.ts" | cut -c1-8) CheerTextModel $(sh "$IS/ui/CheerTextModel.ts" | cut -c1-8)"
  r combo-touch GB_COMBO=1 GB_QUERY='?autoplay=combo' node "$out/int-combo.mjs"
  r combo-invoke GB_COMBO=1 GB_PRELUDE=0 GB_QUERY='?autoplay=combo' node "$out/int-combo.mjs"
  r combo-deadbutton GB_COMBO=1 GB_COMBO_BUTTON=dead GB_QUERY='?autoplay=combo' node "$out/int-combo.mjs"
  r combo-muted GB_COMBO=1 GB_COMBO_MUTED=1 GB_QUERY='?autoplay=combo' node "$out/int-combo.mjs"
  r combo-macro-here-noboard GB_COMBO=1 GB_EXPECT='text=0:no-board,1:no-board,2:no-board,3:no-board .*sfxOk=1 textOk=0' GROKBOT_MACRO='combo:here' node -e "globalThis.GROKBOT_AUTOPLAY='combo:here';import('$out/int-combo.mjs')"
  r combo-noT6 GB_COMBO=1 GB_NO_T6=1 GB_EXPECT='text=absent' GB_QUERY='?autoplay=combo' node "$out/int-combo.mjs"
else echo "SKIP combo integration (set GB_INT_DIR=<int/v1 checkout> to run against the real GameAudio/CheerText)"; fi
echo "artifacts: $out"
