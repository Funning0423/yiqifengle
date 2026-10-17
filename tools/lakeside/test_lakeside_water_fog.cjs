// v3: lakeside water shader (Fresnel sky ramp + sun streak + fog) and LINEAR scene fog; VB values; structure checks for 3.8.8.
const fs=require('fs'),path=require('path'),assert=require('assert');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const A=path.join(__dirname,'../../creator-build-project/assets'),W=path.join(A,'bundles/region_lakeside/water');
const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path.join(A,'scripts/region/LakesideSceneData.ts'),'utf8'),{compilerOptions:{module:1,target:6}}).outputText)(m,m.exports,require);
const D=m.exports,P=D.LAKESIDE_DIR_LIGHT_PARAMS,WS=D.LAKESIDE_WATER_SKY,WD=WS.day,SH=WS.shared,U=D.lakesideWaterUniforms('day');
// Voice Bot verified values
assert.deepEqual([...D.LAKESIDE_R5H3_LIGHT_LINEAR.ambientGround],[1.0,0.5457,0.1441]);assert.deepEqual(D.lakesideCocosLightColor(D.LAKESIDE_R5H3_LIGHT_LINEAR.ambientGround),[255,139,37],"v3.4 Cocos bytes = linear x 255");
assert.equal(SH.fresnelF0,0.02);assert.equal(SH.fresnelPower,5);
assert.deepEqual([...WD.sky.zenithLinear],[0.0116,0.2747,0.4793]);assert.deepEqual([...WD.sky.lowLinear],[0.9216,0.5776,0.2705]);assert.deepEqual([...WD.sky.horizonLinear],[1.0,0.5457,0.1441]);
assert(SH.specExponent>=200&&SH.specExponent<=500&&SH.specNoise===0,'v3.3: streak noise off (its x-striped sin made moving bands)');
assert.deepEqual([...P.fogColorSrgb],[215,170,150]);assert.equal(P.fogStart,60);assert.equal(P.fogMaxAt,130);assert.equal(P.fogMaxAmount,0.4);
const end=D.lakesideFogEnd();assert.equal(end,235);
const amount=d=>Math.min(1,Math.max(0,(d-P.fogStart)/(end-P.fogStart)));assert(Math.abs(amount(130)-0.4)<1e-9);
// board / near shore clear: farthest board corner and near-shore props are < fogStart from the board camera
const cam=[0,13.2,26.5],B=D.LAKESIDE_BOARD_BOUNDS,dist=p=>Math.hypot(p[0]-cam[0],p[1]-cam[1],p[2]-cam[2]);
for(const x of [B.min[0],B.max[0]])for(const z of [B.min[2],B.max[2]])assert(amount(dist([x,0,z]))===0,'board corner fog-free');
// effect structure (3.8.8 builtin-unlit layout); chunks that exist in 3.8.8
const fx=fs.readFileSync(path.join(W,'lakeside-water.effect'),'utf8');
assert(/^CCEffect %\{[\s\S]*?\n\}%/m.test(fx)&&/CCProgram lk-water-vs %\{[\s\S]*?\n\}%/.test(fx)&&/CCProgram lk-water-fs %\{[\s\S]*?\n\}%/.test(fx));
const inc=[...fx.matchAll(/#include <([^>]+)>/g)].map(x=>x[1]);
const ok=['legacy/input-standard','builtin/uniforms/cc-global','legacy/local-batch','legacy/fog-vs','legacy/fog-fs','legacy/output-standard'];
assert(inc.length&&inc.every(i=>ok.includes(i)),'only 3.8.8 chunks: '+inc);
assert(/CC_TRANSFER_FOG\(pos\)/.test(fx)&&/CC_APPLY_FOG\(o, v_worldPos\)/.test(fx),'fog chunk used');
assert(/CCGetWorldMatrixFull\(matWorld, matWorldIT\)/.test(fx),'instancing-aware world matrix');
assert(!/sampler2D|texture\(/.test(fx),'no textures');
const ub=fx.match(/uniform LakesideWater \{([\s\S]*?)\};/)[1].trim().split(/\n/).map(s=>s.trim());assert(ub.every(l=>/^vec4 \w+;$/.test(l)),'std140-safe vec4 block');
// r4 (VB): Cocos 3.8.8 Material._uploadProperty squares (SRGBToLinear) any property tagged `linear: true`; the lease sends linear
// values, so the colour properties must NOT carry the tag (r3 Mac: reflection orange-saturated = the colours squared once more).
{const blk=fx.match(/^CCEffect %\{([\s\S]*?)\n\}%/m)[1];assert(!/linear:\s*true/.test(blk),'water colour uniforms pass through as authored (linear), no linear:true double decode');
 for(const k of ['waterTint','skyZenith','skyLow','skyHorizon'])assert(new RegExp(k+':\\s+\\{ value: \\[[^\\]]*\\], editor: \\{ type: color \\} \\}').test(blk),k+' colour without linear tag');}
for(const k of ['waterTint','skyZenith','skyLow','skyHorizon','fresnelParams','specParams','waveParams','lightParams'])assert(new RegExp('\\n\\s+'+k+':\\s+\\{ value:').test(fx)&&ub.includes('vec4 '+k+';'),k);
// metas / material
const em=JSON.parse(fs.readFileSync(path.join(W,'lakeside-water.effect.meta'))),mt=JSON.parse(fs.readFileSync(path.join(W,'lakeside-water.mtl'))),mm=JSON.parse(fs.readFileSync(path.join(W,'lakeside-water.mtl.meta')));
JSON.parse(fs.readFileSync(path.join(W,'..','water.meta')));
assert.equal(em.importer,'effect');assert.equal(mm.importer,'material');assert.equal(mt._effectAsset.__uuid__,em.uuid);assert.notEqual(em.uuid,mm.uuid);
assert.deepEqual(mt._defines[0],{USE_VERTEX_COLOR:true,USE_WAVES:true,USE_INSTANCING:true});
// lease wiring
const bg=fs.readFileSync(path.join(A,'scripts/region/LakesideBoardBackground.ts'),'utf8');
assert(/loadMaterial\(b,LAKESIDE_WATER_SKY\.shared\.materialPath\)/.test(bg)&&/loadLakesideWaterAsset\(bundle\)/.test(bg)&&/const water=new Material\(\);water\.copy\(waterAsset\);applyLakesideWaterUniforms\(water,lakesideDayNightMode\(\)\);/.test(bg)&&/instanced\.push\(water\)/.test(bg),'own copy with the shared uniforms, destroyed with the lease');
assert(/if\(mats\[k\]\)r\.setSharedMaterial\(water,k\)/.test(bg)&&/shadeLakesideWater\(scenery,waterAsset,'board'\)/.test(bg),'lake gets the water material');
assert(/console\.error\('\[QF_LAKE\] '\+JSON\.stringify\(\{event:'water-material-missing'/.test(bg),'missing water material is logged, never silent');
assert(/fog\.type=0\/\* FogType\.LINEAR/.test(bg)&&/fog\.type=3\/\* FogType\.LAYERED/.test(bg)&&/fog\.fogEnd=lakesideFogEnd\(P\)/.test(bg)&&/restoreDir=\(\)=>\{restoreFog\(\);/.test(bg)&&/applyFog\(\);\};/.test(bg),'fog applied with the lights, restored with them');
assert(/fog\.type=f0\.type;fog\.fogColor=f0\.color;fog\.fogStart=f0\.start;fog\.fogEnd=f0\.end;fog\.fogTop=f0\.top;fog\.fogRange=f0\.range;fog\.fogAtten=f0\.atten;fog\.enabled=f0\.enabled;/.test(bg));
// v3.2 tint: near-white (0.9,1,1) multiplies the r5h3 vertex colours (kept: shallow shore / deep middle); sky-reflection floor 0.25
assert.deepEqual([...WD.tintLinear],[0.9,1.0,1.0]);assert(Math.min(...WD.tintLinear)>=0.9,'no flattening of vertex colours');
// effect defaults = lakesideWaterUniforms('day') for all 8 uniforms (what the shader shows if a setProperty were missed)
{const num=v=>+v;for(const k of D.LAKESIDE_WATER_UNIFORM_NAMES){const mm=fx.match(new RegExp('\\n\\s+'+k+':\\s+\\{ value: \\[([^\\]]*)\\]'));assert(mm,k);assert.deepEqual(mm[1].split(',').map(num),U[k],k+' effect default = shared day value');}}assert(/albedo \*= v_color\.rgb;/.test(fx)&&!/SRGBToLinear\(v_color/.test(fx),'glTF COLOR_0 is linear: no second decode in the shader');
assert.deepEqual(mt._defines[0],{USE_VERTEX_COLOR:true,USE_WAVES:true,USE_INSTANCING:true});
assert.equal(WD.skyReflectFloor,0.31);
assert(/col = mix\(col, sky, clamp\(max\(F, specParams\.w\), 0\.0, fresnelParams\.z\)\);/.test(fx)&&/specParams\.y \* F;/.test(fx),'floor on sky mix only, streak still x F');
assert(/wc=lakesideCocosLightColor\(LAKESIDE_WATER_SKY\.day\.tintLinear\)/.test(bg));assert.deepEqual(D.lakesideCocosLightColor(WD.tintLinear),[230,255,255],'r2: fallback mainColor (legacy albedo uniform, linear) = tint x 255, was sRGB 243/255/255');
// fog modes + URL override (guarded for WeChat)
assert.equal(D.LAKESIDE_FOG_MODE,'layered');
assert.equal(D.lakesideFogMode('?lakefog=off'),'off');assert.equal(D.lakesideFogMode('?a=1&lakefog=linear60'),'linear60');assert.equal(D.lakesideFogMode('?lakefog=layered'),'layered');
assert.equal(D.lakesideFogMode('?lakefog=bogus'),'layered');assert.equal(D.lakesideFogMode(null),'layered');assert.equal(D.lakesideFogMode(''),'layered');
assert.equal(typeof window,'undefined');assert.equal(D.lakesideFogModeFromEnv(),'layered','no window (WeChat) -> constant');
global.window={location:{search:'?lakefog=linear60'}};assert.equal(D.lakesideFogModeFromEnv(),'linear60');
global.window={get location(){throw new Error('x');}};assert.equal(D.lakesideFogModeFromEnv(),'layered','throwing location tolerated');delete global.window;
assert(/const fogMode=lakesideFogModeFromEnv\(\);/.test(bg)&&/if\(fogMode==='off'\)\{fog\.enabled=false;return;\}/.test(bg));
// layered: slab above water, below mountains/trees; fog factor per 3.8.8 LayeredFog()
const Lf=D.LAKESIDE_LAYERED_FOG;assert(Lf.fogTop>0.3&&Lf.fogTop<5.7&&Lf.fogTop<cam[1]);
const lay=(Dh,y)=>{if(y>=Lf.fogTop)return 0;const dD=Dh/Lf.fogAtten*2,dY=(Lf.fogTop-y)/Lf.fogRange*2;return 1-Math.exp(-Math.sqrt(1+(dD/dY)**2)*dY*dY/2);};
assert(lay(77,0)>0.3&&lay(77,0)<0.45&&lay(20,0)<0.15&&lay(85,2)===0);
assert(/fog\.fogTop=L\.fogTop;fog\.fogRange=L\.fogRange;fog\.fogAtten=L\.fogAtten;/.test(bg));
// v3.3 near water: water-only light scales + dimmer reflected sky (floor and tint unchanged); default fog layered; waves fade with distance
// v3.4 (VB): refit under the linear lights (dirlight test) on the Mac-calibrated emulator: near water 58/152/148 vs r5h3 66/152/146
assert.equal(WD.mainLightScale,1.37);assert.equal(WD.ambientScale,1.85);assert.equal(WD.skyStrength,0.35);
assert.deepEqual(U.lightParams,[WD.mainLightScale,WD.ambientScale,SH.waveFadeStart,SH.waveFadeEnd]);
assert(/vec3 col = albedo \* \(lit \* NL \/ 3\.14159265 \* lightParams\.x \+ amb \* lightParams\.y\);/.test(fx),'diffuse main x, ambient y');
assert(/col \+= lit \* pow\(max\(dot\(N, H\), 0\.0\), ex\) \* specParams\.y \* F;/.test(fx),'streak keeps the full main light');
assert(/float wf = 1\.0 - smoothstep\(lightParams\.z, lightParams\.w, length\(cc_cameraPos\.xyz - v_worldPos\)\);/.test(fx)&&/\* \(waveParams\.x \* wf\)\);/.test(fx),'wave fade');
const bd=dist([0,0,B.max[2]]),mid=dist([0,0,-40]);assert(bd<SH.waveFadeEnd&&mid>SH.waveFadeEnd,'waves on the board water, none mid-lake');
const T=require('./water_tune_v33.cjs');// v3.3 fit model (assumes the v3.2 sRGB-byte lights) - kept for its v3.2 reproduction check only
assert.deepEqual(T.predict(T.P0,T.VCS[0]),[63,216,214],'model reproduces the Mac v3.2 pixel 64/218/216');
assert.equal(D.LAKESIDE_FOG_MODE,'layered','v3.3 default fog');
console.log('lakeside water+fog OK fogEnd='+end);
