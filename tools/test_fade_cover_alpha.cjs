'use strict';
// F1: the HomeFadeCover must carry its alpha in the Graphics fill (Cocos 3.8 Graphics ignores UIOpacity → hard cut).
// Source contract + pure ramp maths only; NOT a render. Device/Mac must still confirm intermediate frames.
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHarness}=require('./board-ui/harness.cjs');
const H=createHarness(),{coverAlphaByte,HOME_FADE}=H.load('world-r2/HomeTransition');
const boot=fs.readFileSync('creator-build-project/assets/scripts/WorldIntegrationBoot.ts','utf8');
const body=boot.slice(boot.indexOf('private fadeCover('),boot.indexOf('update(dt:number)'));
assert(!/UIOpacity|\.opacity\s*=/.test(body),'fadeCover/tickCover must not drive the cover through UIOpacity');
assert(/paintCover\(c,c\.from\+\(c\.to-c\.from\)\*t\)/.test(body),'tick must repaint the fill with the interpolated alpha');
assert(/g\.fillColor=new Color\(0,0,0,a\)/.test(boot),'fill colour must carry the alpha byte');
assert.equal(coverAlphaByte(0),0);assert.equal(coverAlphaByte(1),255);assert.equal(coverAlphaByte(2),255);assert.equal(coverAlphaByte(NaN),0);
// a 0.4 s fade sampled at 30 fps must yield distinct intermediate bytes (no 0→255 jump)
const seen=new Set();for(let f=0;f<=12;f++)seen.add(coverAlphaByte(Math.min(1,f/30/HOME_FADE.outS)));
assert(seen.size>=10,'expected a ramp, got '+[...seen]);
console.log('PASS fade cover bakes alpha into Graphics fill; 0.4 s ramp has',seen.size,'levels');
