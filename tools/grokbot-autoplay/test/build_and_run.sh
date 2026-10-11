#!/usr/bin/env bash
# Usage: tools/grokbot-autoplay/test/build_and_run.sh [T1_DIR]
# Needs node>=18 and esbuild@0.21.5 (GB_TOOLS=<dir with node_modules/esbuild>, default /tmp/gb-t0-tools).
# Loose-ES5 jobs (Cocos-build hazard check) also need, in the same GB_TOOLS: @babel/core@7.29.7 @babel/preset-env@7.29.7 @babel/preset-typescript@7.28.5
#   (see package.json). They re-run the key paths with the T0 sources (src/*.ts) first compiled like Cocos' build does: babel preset-env
#   loose:true, targets ie 11 -> [...x] becomes [].concat(x), for-of/destructuring become index-based. GB_LOOSE=0 skips them (not recommended).
# T1_DIR (optional) = extracted T1-lighthouse-return-baseline package; enables the T1 touch/return tests against the REAL T1 code.
# GB_INT_DIR (optional env) = checkout of int/v1 (5d66c30 or newer; dir containing creator-build-project/); enables autoplay=combo
#   integration tests against the REAL int/v1 audio/GameAudio.ts + ui/CheerText.ts (+CheerTextModel). Without it they are SKIPPED.
# GB_UNLOCK_DIR (optional env) = checkout with creator-build-project/assets/scripts/audio/AudioUnlock.ts (work/GGbot-audiounlock); enables audio:unlock
#   out-and-back tests against the REAL RoomExploreOverlay + AudioUnlock (door-tap / room-swipe / raw wx touch).
# GB_T9_DIR (optional env) = checkout of work/GGbot-t9 (380891d or newer); enables the T9 named prop target tests (signpost/bag/book/settings, ui:tap).
set -euo pipefail
export GB_PRELUDE_FILE="$(cd "$(dirname "$0")/.." && pwd)/prelude/gb-touch-prelude.js"
here="$(cd "$(dirname "$0")" && pwd)"; tools="${GB_TOOLS:-/tmp/gb-t0-tools}"; out="$(mktemp -d)"; t1="${1:-}"
scripts="$here/../../../creator-build-project/assets/scripts"
NODE_PATH="$tools/node_modules" node - "$here" "$out" "$scripts" "$t1" "${GB_INT_DIR:-}" "${GB_T9_DIR:-}" <<'JS'
const [here,out,scripts,t1,intDir,t9Dir]=process.argv.slice(2);const path=require('path');const esbuild=require('esbuild');const fs=require('fs');
const LOOSE=process.env.GB_LOOSE!=='0';const srcDir=path.resolve(here,'../src')+path.sep;
/** Cocos-like loose ES5 transform, applied ONLY to T0 sources (that is what we ship); everything else is bundled as-is. */
const loosePlugin={name:'cocos-loose-es5',setup(b){const babel=require('@babel/core');b.onLoad({filter:/\.ts$/},a=>{if(!a.path.startsWith(srcDir))return undefined;
 const r=babel.transformSync(fs.readFileSync(a.path,'utf8'),{filename:a.path,babelrc:false,configFile:false,sourceType:'module',
  presets:[[require.resolve('@babel/preset-env'),{loose:true,modules:false,targets:{ie:'11'}}],[require.resolve('@babel/preset-typescript'),{onlyRemoveTypeImports:false}]]});
 if(/\[\.\.\./.test(r.code))throw Error('loose transform left a spread in '+a.path);fs.writeFileSync(path.join(out,'loose-'+path.basename(a.path,'.ts')+'.js'),r.code);return {contents:r.code,loader:'js'};});}};
const loose=(cfg)=>({...cfg,outfile:cfg.outfile.replace(/\.mjs$/,'-loose.mjs'),plugins:[loosePlugin,...cfg.plugins]});
const mk=(entry,file,overlay,home,proptaps)=>({entryPoints:[path.join(here,entry)],outfile:path.join(out,file),bundle:true,platform:'node',format:'esm',target:'node18',logLevel:'error',
 alias:{cc:path.join(here,'cc-stub.mjs'),'cc/env':path.join(here,'cc-env-stub.mjs')},
 plugins:[{name:'stubs',setup(b){b.onResolve({filter:/(^|\/)(WarmButton|JourneyNavigationSkin)$/},()=>({path:path.join(here,'ui-stubs.mjs')}));b.onResolve({filter:/(^|\/)audio\/GameAudio$/},()=>({path:path.join(here,'gameaudio-stub.mjs')}));
  b.onResolve({filter:/^#overlay$/},()=>({path:overlay}));b.onResolve({filter:/^#home$/},()=>({path:home}));b.onResolve({filter:/^#board$/},()=>({path:path.join(here,'board-stub.mjs')}));
  b.onResolve({filter:/^#proptaps$/},()=>({path:proptaps||path.join(here,'empty.mjs')}));
  b.onResolve({filter:/^#(gameaudio|cheertext)$/},()=>({path:path.join(here,'empty.mjs')}));}}]});
/** combo job: REAL int/v1 GameAudio + CheerText (ccclass decorators), ManagedMobileBoardUI -> board stub; nothing else redirected to fakes. */
const mkCombo=(entry,file,intScripts)=>({entryPoints:[path.join(here,entry)],outfile:path.join(out,file),bundle:true,platform:'node',format:'esm',target:'node18',logLevel:'error',
 tsconfigRaw:{compilerOptions:{experimentalDecorators:true}},alias:{cc:path.join(here,'cc-stub.mjs'),'cc/env':path.join(here,'cc-env-stub.mjs')},
 plugins:[{name:'combo',setup(b){b.onResolve({filter:/(^|\/)(WarmButton|JourneyNavigationSkin)$/},()=>({path:path.join(here,'ui-stubs.mjs')}));
  b.onResolve({filter:/(^|\/)ManagedMobileBoardUI$/},()=>({path:path.join(here,'board-stub.mjs')}));b.onResolve({filter:/^#board$/},()=>({path:path.join(here,'board-stub.mjs')}));
  b.onResolve({filter:/^#overlay$/},()=>({path:path.join(scripts,'world-r2/IslandJourneyOverlay.ts')}));b.onResolve({filter:/^#home$/},()=>({path:path.join(here,'empty.mjs')}));
  b.onResolve({filter:/^#proptaps$/},()=>({path:path.join(here,'empty.mjs')}));
  b.onResolve({filter:/^#gameaudio$/},()=>({path:path.join(intScripts,'audio/GameAudio.ts')}));b.onResolve({filter:/^#cheertext$/},()=>({path:path.join(intScripts,'ui/CheerText.ts')}));}}]});
const base=[path.join(scripts,'world-r2/IslandJourneyOverlay.ts'),path.join(here,'empty.mjs')];
const jobs=[esbuild.build(mk('combo.test.ts','combounit.mjs',...base)),esbuild.build(mk('sequencer.test.ts','sequencer.mjs',...base)),esbuild.build(mk('touch.test.ts','touchunit.mjs',...base)),esbuild.build(mk('integration.ts','int-base.mjs',...base)),esbuild.build(mk('integration-touch.ts','touch-base.mjs',...base))];
if(t1)for(const v of ['l123','l12']){const a=path.join(t1,'variants/baseline-'+v+'/after/creator-build-project/assets/scripts');const o=path.join(a,'world-r2/IslandJourneyOverlay.ts'),h=path.join(a,'world-r2/IslandHomeInteraction.ts');
 jobs.push(esbuild.build(mk('integration.ts','int-'+v+'.mjs',o,h)),esbuild.build(mk('integration-touch.ts','touch-'+v+'.mjs',o,h)));}
/** T9 job: REAL work/GGbot-t9 overlay + IslandPropTaps + IslandHomeInteraction. */
const t9=t9Dir&&path.join(t9Dir,'creator-build-project/assets/scripts');
if(t9){const a=[path.join(t9,'world-r2/IslandJourneyOverlay.ts'),path.join(t9,'world-r2/IslandHomeInteraction.ts'),path.join(t9,'world-r2/IslandPropTaps.ts')];jobs.push(esbuild.build(mk('integration-t9.ts','int-t9.mjs',...a)));if(LOOSE)jobs.push(esbuild.build(loose(mk('integration-t9.ts','int-t9.mjs',...a))));}
/** audio-unlock job: REAL RoomExploreOverlay + REAL audio/AudioUnlock.ts from GB_UNLOCK_DIR (work/GGbot-audiounlock or int/v1 after merge);
 *  AudioUnlock's './GameAudio' -> gameaudio-unlock-stub (delegates to the harness FakeGameAudio). */
const unlockDir=process.env.GB_UNLOCK_DIR&&path.join(process.env.GB_UNLOCK_DIR,'creator-build-project/assets/scripts');
const mkUnlock=(entry,file)=>{const c=mk(entry,file,...base);c.plugins=[{name:'unlock',setup(b){b.onResolve({filter:/RoomExploreOverlay$/},()=>({path:path.join(unlockDir,'RoomExploreOverlay.ts')}));
 b.onResolve({filter:/^\.\/GameAudio$/},a=>a.importer.endsWith('AudioUnlock.ts')?{path:path.join(here,'gameaudio-unlock-stub.mjs')}:undefined);}},...c.plugins];return c;};
if(unlockDir){jobs.push(esbuild.build(mkUnlock('integration.ts','int-unlock.mjs')));if(LOOSE)jobs.push(esbuild.build(loose(mkUnlock('integration.ts','int-unlock.mjs'))));}
if(intDir)jobs.push(esbuild.build(mkCombo('integration-combo.ts','int-combo.mjs',path.join(intDir,'creator-build-project/assets/scripts'))));
if(LOOSE){jobs.push(esbuild.build(loose(mk('sequencer.test.ts','sequencer.mjs',...base))),esbuild.build(loose(mk('touch.test.ts','touchunit.mjs',...base))),esbuild.build(loose(mk('combo.test.ts','combounit.mjs',...base))),
  esbuild.build(loose(mk('integration.ts','int-base.mjs',...base))),esbuild.build(loose(mk('integration-touch.ts','touch-base.mjs',...base))));
 if(intDir)jobs.push(esbuild.build(loose(mkCombo('integration-combo.ts','int-combo.mjs',path.join(intDir,'creator-build-project/assets/scripts')))));}
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
r caps-webgl1 GB_CAPS=webgl1 node "$out/int-base.mjs"
r caps-throw GB_CAPS=throw node "$out/int-base.mjs"
r caps-nodevice GB_CAPS=nodevice node "$out/int-base.mjs"
r caps-apron-scene GB_CAPS_APRON=scene node "$out/int-base.mjs"
r caps-apron-driver GB_CAPS_APRON=driver node "$out/int-base.mjs"
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
if [ -n "${GB_T9_DIR:-}" ]; then
  echo "t9 targets against REAL work/GGbot-t9 sources: IslandJourneyOverlay $(sha256sum "$GB_T9_DIR/creator-build-project/assets/scripts/world-r2/IslandJourneyOverlay.ts" | cut -c1-8) IslandPropTaps $(sha256sum "$GB_T9_DIR/creator-build-project/assets/scripts/world-r2/IslandPropTaps.ts" | cut -c1-8)"
  r t9-props GB_T9=1 GB_T1=l123 GB_QUERY='?autoplay=touch&gbScenario=t9' node "$out/int-t9.mjs"
  [ "${GB_LOOSE:-1}" != 0 ] && r loose-t9-props GB_T9=1 GB_T1=l123 GB_QUERY='?autoplay=touch&gbScenario=t9' node "$out/int-t9-loose.mjs"
else echo "SKIP t9 prop targets (set GB_T9_DIR=<work/GGbot-t9 checkout>)"; fi
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
if [ -n "${GB_UNLOCK_DIR:-}" ]; then
  US="$GB_UNLOCK_DIR/creator-build-project/assets/scripts"
  echo "audio unlock against REAL sources: RoomExploreOverlay $(sha256sum "$US/RoomExploreOverlay.ts" | cut -c1-8) AudioUnlock $(sha256sum "$US/audio/AudioUnlock.ts" | cut -c1-8)"
  r unlock-oab-visible GB_UNLOCK=door-tap GB_DOOR_VISIBLE=visible node "$out/int-unlock.mjs"
  r unlock-oab-hidden GB_UNLOCK=door-tap GB_DOOR_VISIBLE=hidden node "$out/int-unlock.mjs"
  r unlock-oab-drag GB_UNLOCK=room-swipe GB_DOOR_VISIBLE=reveal-by-drag GB_QUERY='?autoplay=out-and-back&gbDoor=drag' node "$out/int-unlock.mjs"
  r unlock-oab-wxtouch GB_UNLOCK=wx GB_UNLOCK_WXTOUCH=1 GB_QUERY='?autoplay=out-and-back&gbStart=4000' node "$out/int-unlock.mjs"
  [ "${GB_LOOSE:-1}" != 0 ] && r loose-unlock-oab-wxtouch GB_UNLOCK=wx GB_UNLOCK_WXTOUCH=1 GB_QUERY='?autoplay=out-and-back&gbStart=4000' node "$out/int-unlock-loose.mjs"
else echo "SKIP audio unlock (set GB_UNLOCK_DIR=<work/GGbot-audiounlock checkout>)"; fi
if [ "${GB_LOOSE:-1}" != 0 ]; then
  # Same key paths with T0 compiled Cocos-style (loose ES5). Boot is ON the Scene node (real Cocos layout) unless GB_BOOT_ON=child.
  r loose-unit-seq node "$out/sequencer-loose.mjs"
  r loose-unit-touch node "$out/touchunit-loose.mjs"
  r loose-unit-combo node "$out/combounit-loose.mjs"
  r loose-oab-visible GB_DOOR_VISIBLE=visible node "$out/int-base-loose.mjs"
  r loose-oab-drag GB_DOOR_VISIBLE=reveal-by-drag GB_QUERY='?autoplay=out-and-back&gbDoor=drag' node "$out/int-base-loose.mjs"
  r loose-oab-boot-child GB_BOOT_ON=child node "$out/int-base-loose.mjs"
  r loose-caps-webgl1 GB_CAPS=webgl1 node "$out/int-base-loose.mjs"
  r loose-caps-throw GB_CAPS=throw GB_CAPS_APRON=scene node "$out/int-base-loose.mjs"
  r loose-touch-noT1 GB_QUERY='?autoplay=touch&gbScenario=t1' node "$out/touch-base-loose.mjs"
  if [ -n "${GB_INT_DIR:-}" ]; then r loose-combo-touch GB_COMBO=1 GB_QUERY='?autoplay=combo' node "$out/int-combo-loose.mjs"; r loose-combo-muted GB_COMBO=1 GB_COMBO_MUTED=1 GB_QUERY='?autoplay=combo' node "$out/int-combo-loose.mjs"; fi
  for f in "$out"/loose-*.js; do if grep -nE '\[\]\.concat\((this\.down|[a-zA-Z_.]*(Map|Set)\b)' "$f"; then echo "FAIL: loose output concat()s a Map/Set: $f"; exit 1; fi; done
  echo "PASS loose-ES5 (Cocos-like babel preset-env loose, ie 11): T0 sources $(ls "$out"/loose-*.js | wc -l | tr -d ' ') files transformed, key paths ran"
else echo "SKIP loose-ES5 jobs (GB_LOOSE=0)"; fi
echo "artifacts: $out"
