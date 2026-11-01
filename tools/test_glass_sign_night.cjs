'use strict';
// cine/night-glass-r4 (运镜bot): locks the night-only glass set and proves the day refine 3.2 values are unchanged.
// Engine-free (cc stubbed); not render/device acceptance.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const A=path.join(__dirname,'..','creator-build-project/assets');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('./qf-env.cjs').typescript());
const src=fs.readFileSync(path.join(A,'scripts/world-r1/GlassSign.ts'),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let W=0;
const mod={exports:{}};const req=n=>{if(n==='cc')return new Proxy({},{get:()=>function(){}});if(n==='../ui/NightTint')return{uiNightWeight:()=>W};throw Error('unexpected import '+n);};
vm.runInThisContext('(function(module,exports,require){'+js+'\n})')(mod,mod.exports,req);
const {GLASS_SIGN:D,GLASS_SIGN_NIGHT:N,glassSignLook}=mod.exports;
// 1) day refine 3.2 values (approved glass-panel-v4refined3.2-20261016T1419Z + round 2) unchanged
assert.deepEqual(D.rim,{alpha:0.43,gamma:0.6,widthCss:1.3});assert.deepEqual(D.top,{alpha:0.8,widthCss:1.2,gamma:0.6});
assert.deepEqual([...D.centre],[0.05,1.02,-4.70]);assert.equal(D.widthM,0.80);assert.equal(D.heightM,0.28);
assert.deepEqual([...D.text.color],[255,255,255,255]);assert.deepEqual([...D.text.shadow],[0,40,60,115]);assert.equal(D.text.shadowBlur,6);
assert(/l\.color = new Color\(255, 255, 255, 255\)/.test(src)&&/l\.shadowColor = new Color\(0, 40, 60, 115\)/.test(src),'built day Label unchanged');
// 2) weight 0 = identity on every shader multiplier, day text, no outline
const d=glassSignLook(0);
for(const k of ['params3','params4','params5'])assert.deepEqual(d[k].slice(0,3),[1,1,1],k+' identity at day');
assert.deepEqual(d.text,[255,255,255,255]);assert.deepEqual(d.shadow,[0,40,60,115]);assert.equal(d.shadowBlur,6);assert.equal(d.outline,null);
assert.deepEqual(glassSignLook(NaN),d);assert.deepEqual(glassSignLook(-3),d);
// 3) night set locked: base opacity greatly lowered, dark warm tint, highlights <= half day, single thin rim
assert.deepEqual({...N,baseTint:[...N.baseTint],rimTint:[...N.rimTint],text:{...N.text,color:[...N.text.color],shadow:[...N.text.shadow],outline:[...N.text.outline]}},
 {baseAlpha:0.45,baseTint:[0.22,0.15,0.09],rim:0.45,rimTint:[1.0,0.86,0.66],top:0.0,text:{color:[232,226,212,255],shadow:[20,12,5,200],shadowBlur:3,outline:[38,24,12,230],outlineWidth:1.5}});
assert(N.baseAlpha<=0.5&&N.rim<=0.5&&N.top<=0.5,'night highlights <= half of day');
assert(N.baseTint[0]>N.baseTint[1]&&N.baseTint[1]>N.baseTint[2]&&Math.max(...N.baseTint)<=0.35,'base tint dark and warm');
assert(N.rimTint[0]>=N.rimTint[1]&&N.rimTint[1]>=N.rimTint[2]&&N.rimTint[2]>=0.6,'rim only slightly warm');
const n=glassSignLook(1);assert.deepEqual(n.params3,[0.45,0.45,0,0]);assert.deepEqual(n.params4,[0.22,0.15,0.09,0]);assert.deepEqual(n.outline,[38,24,12,230]);
// 4) WCAG text contrast: caption vs its outline >= 4.5 (night); text not on a white base
const lum=c=>{const v=c.slice(0,3).map(x=>{const s=x/255;return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4);});return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
assert(cr(N.text.color,N.text.outline)>=4.5,'caption vs outline '+cr(N.text.color,N.text.outline).toFixed(2));
// 5) shader: night multipliers wired, day defaults are identity
const fx=fs.readFileSync(path.join(A,'resources/world/glass-sign.effect'),'utf8');
for(const k of ['params3','params4','params5'])assert(new RegExp(k+': \\{ value: \\[1\\.0, 1\\.0, 1\\.0, 0\\.0\\] \\}').test(fx),k+' default identity');
assert(/cover \* params3\.x;/.test(fx)&&/vec4\(params4\.rgb \* ca, ca\)/.test(fx)&&/\* params3\.y;/.test(fx)&&/\* params3\.z;/.test(fx)&&/vec4\(params5\.rgb \* rim, rim\)/.test(fx),'shader night wiring');
assert(/0\.34, 0\.10, t \/ 0\.55/.test(fx)&&/fa \+= 0\.08;/.test(fx),'day base gradient unchanged');
// 6) room hint text: day outline unchanged, night outline darker warm
const ro=fs.readFileSync(path.join(A,'scripts/RoomExploreOverlay.ts'),'utf8');
assert(/l\.outlineColor=new Color\(33,45,45,170\)/.test(ro)&&/day:\[33,45,45,170\],night:\[38,24,12,230\]/.test(ro));
assert(cr([255,242,207],[38,24,12])>=4.5);
console.log('glass sign night OK',JSON.stringify({captionVsOutline:+cr(N.text.color,N.text.outline).toFixed(2),hintVsOutline:+cr([255,242,207],[38,24,12]).toFixed(2)}));
