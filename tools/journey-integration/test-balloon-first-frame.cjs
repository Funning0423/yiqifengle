'use strict';
// full9c balloon-first-frame (m 600–602 / mday 536–538 clear colour 153,170,186; m2 camTrace f3515→3516 278 ms): the balloon
// must be moored on its B1 t=0 pose before the meadow pre-walk (first draw during the walk), B1 must hold the live lens until a
// frame has been drawn with it placed, and only from before-draw (single writer). [QF_B1_GAP] carries load/instantiate/first draw.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const s=fs.readFileSync(process.env.BFF_SRC||path.join(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
const place=s.search(/if\(contChain\)\{const w0=plan\.vehicle\(0\);vehicle\.setWorldPosition\(/),prewalk=s.indexOf("await actor.perform({kind:'walk',path:pre.path");
assert.ok(place>0,'balloon is first placed into view on the B1 cut (no mooring before the pre-walk)');
assert.ok(prewalk>0&&place<prewalk,'mooring must precede the pre-walk');
assert.match(s,/director\.on\(Director\.EVENT_AFTER_DRAW,b1AfterDraw\)/,'no first-draw signal');
const b1=s.slice(s.indexOf('const b1Draw=()=>{'),s.indexOf('const b1Draw=()=>{')+600);
assert.match(b1,/if\(!b1Drawn\)\{[^}]*camTag\('BalloonTransit:B1-hold'\);world\.setCamera\(b1Hold\);\}return;\}/,'B1 does not hold the live lens before the first draw');
assert.match(s,/director\.on\(Director\.EVENT_BEFORE_DRAW,b1Draw\)/,'B1 writes only from before-draw');
assert.match(s,/Object\.assign\(b1Gap\.ph,\{loadMs:b1Load,instantiateMs:b1Inst,firstDrawMs:b1FirstDraw/,'[QF_B1_GAP] lacks load/instantiate/first-draw phases');
assert.ok((s.match(/director\.off\(Director\.EVENT_AFTER_DRAW,b1AfterDraw\)/g)||[]).length>=1,'first-draw listener never removed');
console.log('balloon-first-frame: PASS');
