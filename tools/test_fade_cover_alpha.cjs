'use strict';
// F1 → WindWipe (2026-10-25): the shared cover is the 风云擦除 band (ui/WindWipe.ts). It must be repainted every tick from the
// foreground-time ramp (no UIOpacity on the band: Cocos 3.8 Graphics ignores it), and a ramp must produce many distinct
// intermediate band positions (no hard cut). Source contract + pure maths only; NOT a render.
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHarness}=require('./board-ui/harness.cjs');
const H=createHarness(),{WindWipeState}=H.load('world-r2/WindWipeCore'),{HOME_FADE}=H.load('world-r2/HomeTransition');
const boot=fs.readFileSync('creator-build-project/assets/scripts/WorldIntegrationBoot.ts','utf8');
const body=boot.slice(boot.indexOf('private fadeCover('),boot.indexOf('update(dt:number)'));
assert(!/UIOpacity|\.opacity\s*=/.test(body),'fadeCover/tickCover must not drive the cover through UIOpacity');
assert(/w\.ramp\(to,/.test(body)&&/w\.tick\(this\.fg\.now\(\),dt\)/.test(body),'cover ramps on foreground time and ticks every frame');
assert(/update\(dt:number\)\{this\.fg\.tick\(dt,this\.flowPaused\(\)\);this\.tickCover\(dt\);/.test(boot));
const st=new WindWipeState(),seen=new Set();st.set(1,HOME_FADE.outS,0);for(let f=0;f<=14;f++){st.tick(f/30);seen.add(st.shape().lead.toFixed(3));}
assert(seen.size>=10,'expected a sweep, got '+[...seen]);
console.log('PASS WindWipe cover repaints per tick on foreground time; 0.45 s OUT sweep has',seen.size,'positions');
