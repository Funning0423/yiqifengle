// D1: lakeside 'dir' lighting - main DirectionalLight = json Sun (exact), dusk 0.31 -> ambient, 0.08 dropped, no point lights, saved/restored.
const fs=require('fs'),path=require('path'),assert=require('assert');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const A=path.join(__dirname,'../../creator-build-project/assets');
const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path.join(A,'scripts/region/LakesideSceneData.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText)(m,m.exports,require);
const D=m.exports,P=D.LAKESIDE_DIR_LIGHT_PARAMS,J=JSON.parse(fs.readFileSync(path.join(A,'bundles/region_lakeside/scene_r5h3_lighting.json'),'utf8'));
const L=n=>J.lights.find(l=>l.name===n);
assert.equal(D.LAKESIDE_LIGHT_MODE,'dir');
assert.deepEqual([...P.sunForward],L('Sun').forward,'main = json Sun direction');
// v3.4/r2: Cocos takes light/ambient Color bytes/255 as linear -> params are linear and the ONE conversion lakesideCocosLightColor gives r5h3 linear x 255
const R=D.LAKESIDE_R5H3_LIGHT_LINEAR,b8=c=>c.map(v=>Math.round(v*255));
assert.deepEqual([...R.sun],L('Sun').colorLinear,'r5h3 = json Sun colour');assert.deepEqual([...P.sunColorLinear],[...R.sun],'param is linear');assert.deepEqual(D.lakesideCocosLightColor(P.sunColorLinear),b8(R.sun),'Cocos sun = json Sun (linear)');
assert.deepEqual(D.lakesideCocosLightColor(R.ambientSky),b8(R.ambientSky));assert.deepEqual(D.lakesideCocosLightColor(R.ambientGround),b8(R.ambientGround));
for(let i=0;i<101;i++){const x=i/100;assert.equal(D.lakesideCocosLightColor([x,x,x])[0],Math.round(x*255),'linear -> byte '+x);}
assert.equal(P.sunIlluminanceScale,0.5,'v3.4 sun 0.5 x base (emulator fit, device check)');
// v2: blue sky (r5h3 world ramp top stop), warm ground, bluer water, blue clear colour
const sky=R.ambientSky;assert.deepEqual([...sky],[0.0116,0.2747,0.4793]);assert(sky[2]>sky[1]&&sky[1]>sky[0],'sky is blue, not the dusk yellow');
const gr=R.ambientGround;assert(gr[0]>gr[1]&&gr[1]>gr[2],'ground stays warm');
assert.equal(P.ambientSkyIllumToSun,0.2,'v3.4: 0.75 only compensated the sRGB-as-linear bytes; real linear colours need 0.2 (0.4 x lakeside sun)');
const wt=P.waterTintLinear;assert(wt[2]>=wt[1]&&wt[1]>wt[0]&&wt.every(c=>c>=0&&c<=1),'water tint cyan-blue, a valid Color');assert.deepEqual([...P.waterGlbs],['LK_lake.glb']);
assert.deepEqual([...P.clearColorLinear],[...sky],'clear colour = sky stop');assert.deepEqual(D.linearToSrgb8(P.clearColorLinear),[28,143,184]);
assert(!JSON.stringify(P).includes('0.212'),'Sun.001 (0.08) dropped, not folded');
assert.deepEqual(D.lakesideCocosLightColor(P.sunColorLinear),[255,153,82]);
const bg=fs.readFileSync(path.join(A,'scripts/region/LakesideBoardBackground.ts'),'utf8');
assert(/if\(LAKESIDE_LIGHT_MODE==='points'\)for\(const l of LAKESIDE_LIGHTS\)/.test(bg),'SphereLights only in points mode');
assert(/getChildByName\('Main Light'\)/.test(bg)&&!/addComponent\(DirectionalLight\)/.test(bg),'reuses the scene main light, never adds one');
assert(/l\.node\.lookAt\(new Vec3\(w\.x\+f\[0\],w\.y\+f\[1\],w\.z\+f\[2\]\)\)/.test(bg),'forward = sunForward');
assert(/visibility=saved\.vis\|LAKESIDE_LAYER/.test(bg),'main light reaches the lake layer');
assert(/setVisible:value=>\{[^}]*if\(value\)applyDir\(\);else restoreDir\(\);\}/.test(bg)&&/dispose=\(\)=>\{if\(dead\)return;restoreDir\(\);/.test(bg),'apply on show, restore on hide/dispose');
assert(/s0\.light\.node\.setRotation\(s0\.rot\);s0\.light\.color=s0\.color;s0\.light\.illuminance=s0\.illum;/.test(bg)&&/amb\.skyLightingColor=s0\.sky;amb\.groundLightingColor=s0\.ground;amb\.skyIllum=s0\.skyIllum;/.test(bg),'full restore');
assert(/m\.setProperty\('mainColor',new Color\(wc\[0\],wc\[1\],wc\[2\],255\)\)/.test(bg)&&/instanced\.includes\(m\)/.test(bg),'water tint only on the lease-owned instanced copy');
assert(/camera\.clearColor=LAKESIDE_LIGHT_MODE==='dir'\?/.test(bg),'dir mode clear colour from params');
assert(!/shadowEnabled|shadowFixedArea|ShadowType/.test(bg),'shadows untouched');
console.log('lakeside dirlight OK');
