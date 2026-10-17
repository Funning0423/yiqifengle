// v3: lakeside water shader (Fresnel sky ramp + sun streak + fog) and LINEAR scene fog; VB values; structure checks for 3.8.8.
const fs=require('fs'),path=require('path'),assert=require('assert');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const A=path.join(__dirname,'../../creator-build-project/assets'),W=path.join(A,'bundles/region_lakeside/water');
const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path.join(A,'scripts/region/LakesideSceneData.ts'),'utf8'),{compilerOptions:{module:1,target:6}}).outputText)(m,m.exports,require);
const D=m.exports,P=D.LAKESIDE_DIR_LIGHT_PARAMS;
// Voice Bot verified values
assert.deepEqual([...D.LAKESIDE_R5H3_LIGHT_LINEAR.ambientGround],[1.0,0.5457,0.1441]);assert.deepEqual(D.lakesideCocosLightColor(D.LAKESIDE_R5H3_LIGHT_LINEAR.ambientGround),[255,139,37],"v3.4 Cocos bytes = linear x 255");
assert.equal(P.waterFresnelF0,0.02);assert.equal(P.waterFresnelPower,5);
// r4 refit: reflected sky is no longer the r5h3 dusk beige/orange (squared by Cocos = the sand look): olive shore horizon, blue low, lavender zenith
assert.deepEqual([...P.waterSkyZenithLinear],[0.3,0.15,0.465]);assert.deepEqual([...P.waterSkyLowLinear],[0.173,0.221,0.481]);assert.deepEqual([...P.waterSkyHorizonLinear],[0.204,0.297,0.003]);
assert(P.waterSpecExponent>=200&&P.waterSpecExponent<=500&&P.waterSpecNoise===0,'v3.3: streak noise off (its x-striped sin made moving bands)');
assert.deepEqual([...P.fogColorSrgb],[231,165,125]);assert.equal(P.fogStart,60);assert.equal(P.fogMaxAt,130);assert.equal(P.fogMaxAmount,0.4);
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
assert(/loadMaterial\(bundle,LAKESIDE_DIR_LIGHT_PARAMS\.waterMaterialPath\)/.test(bg)&&/water=new Material\(\),[^;]*;water\.copy\(asset\);/.test(bg)&&/water=lakesideWaterMaterial\(waterAsset\)/.test(bg)/* r4-prep D: shared helper */&&/instanced\.push\(water\)/.test(bg),'own copy, destroyed with the lease');
assert(/r\.setSharedMaterial\(water,k\)/.test(bg),'lake gets the water material');
assert(/fog\.type=0\/\* FogType\.LINEAR/.test(bg)&&/fog\.type=3\/\* FogType\.LAYERED/.test(bg)&&/fog\.fogEnd=lakesideFogEnd\(P\)/.test(bg)&&/restoreDir=\(\)=>\{restoreFog\(\);/.test(bg)&&/applyFog\(\);\};/.test(bg),'fog applied with the lights, restored with them');
assert(/fog\.type=f0\.type;fog\.fogColor=f0\.color;fog\.fogStart=f0\.start;fog\.fogEnd=f0\.end;fog\.fogTop=f0\.top;fog\.fogRange=f0\.range;fog\.fogAtten=f0\.atten;fog\.enabled=f0\.enabled;/.test(bg));
// v3.2 tint: near-white (0.9,1,1) multiplies the r5h3 vertex colours (kept: shallow shore / deep middle); sky-reflection floor 0.25
// r4: tint saturation fitted on the engine-camera reference; still a multiply on the r5h3 vertex colours (shallow shore / deep middle kept)
assert.deepEqual([...P.waterTintLinear],[0.714,0.858,1.0]);assert(Math.min(...P.waterTintLinear)>=0.6,'no flattening of vertex colours');
// effect defaults = the day values the shared writers put on the copy (shown if a setProperty were ever missed)
{const day=[['waterTint',[...P.waterTintLinear,1]],['skyZenith',[...P.waterSkyZenithLinear,1]],['skyLow',[...P.waterSkyLowLinear,1]],['skyHorizon',[...P.waterSkyHorizonLinear,1]],['fresnelParams',[P.waterFresnelPower,P.waterFresnelF0,P.waterFresnelMax,P.waterSkyStrength]],['specParams',[P.waterSpecExponent,P.waterSpecIntensity,P.waterSpecNoise,P.waterSkyReflectFloor]],['waveParams',[P.waterWaveTilt,P.waterWaveFreq,P.waterWaveSpeed,0]],['lightParams',[P.waterMainLightScale,P.waterAmbientScale,P.waterWaveFadeStart,P.waterWaveFadeEnd]]];
 for(const [k,v] of day){const mm=fx.match(new RegExp('\\n\\s+'+k+':\\s+\\{ value: \\[([^\\]]*)\\]'));assert(mm,k);assert.deepEqual(mm[1].split(',').map(Number),v,k+' effect default = day param');}}
assert(/albedo \*= v_color\.rgb;/.test(fx)&&!/SRGBToLinear\(v_color/.test(fx),'glTF COLOR_0 is linear: no second decode in the shader');
assert.deepEqual(mt._defines[0],{USE_VERTEX_COLOR:true,USE_WAVES:true,USE_INSTANCING:true});
assert.equal(P.waterSkyReflectFloor,0.323);
assert(/col = mix\(col, sky, clamp\(max\(F, specParams\.w\), 0\.0, fresnelParams\.z\)\);/.test(fx)&&/specParams\.y \* F;/.test(fx),'floor on sky mix only, streak still x F');
assert(/P\.waterSpecNoise,P\.waterSkyReflectFloor\)/.test(bg));
assert(/wc=lakesideCocosLightColor\(P\.waterTintLinear\)/.test(bg));assert.deepEqual(D.lakesideCocosLightColor(P.waterTintLinear),[182,219,255],'r2: fallback mainColor (legacy albedo uniform, linear) = tint x 255 (r4 tint 0.714/0.858/1)');
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
// r4 refit: thicker (top 4.16) but much softer slab (range 74, atten 59.2): ~14% at the far shore, ~4% at 20 m, none above the top
assert(lay(77,0)>0.1&&lay(77,0)<0.2&&lay(20,0)<0.05&&lay(85,Lf.fogTop)===0&&lay(85,6)===0);
assert(/fog\.fogTop=L\.fogTop;fog\.fogRange=L\.fogRange;fog\.fogAtten=L\.fogAtten;/.test(bg));
// v3.3 near water: water-only light scales + dimmer reflected sky (floor and tint unchanged); default fog layered; waves fade with distance
// v3.4 (VB): refit under the linear lights (dirlight test) on the Mac-calibrated emulator: near water 58/152/148 vs r5h3 66/152/146
// r4 refit (r3 1.37 / 1.85 / 0.35)
assert.equal(P.waterMainLightScale,2.51);assert.equal(P.waterAmbientScale,2.87);assert.equal(P.waterSkyStrength,0.387);
assert(/lightParams:\s+\{ value: \[2\.51, 2\.87, 12\.0, 35\.0\]/.test(fx),'effect defaults = params (fallback if setProperty fails)');
assert(/water\.setProperty\('lightParams',new Vec4\(P\.waterMainLightScale,P\.waterAmbientScale,P\.waterWaveFadeStart,P\.waterWaveFadeEnd\)\)/.test(bg));
assert(/vec3 col = albedo \* \(lit \* NL \/ 3\.14159265 \* lightParams\.x \+ amb \* lightParams\.y\);/.test(fx),'diffuse main x, ambient y');
assert(/col \+= lit \* pow\(max\(dot\(N, H\), 0\.0\), ex\) \* specParams\.y \* F;/.test(fx),'streak keeps the full main light');
assert(/float wf = 1\.0 - smoothstep\(lightParams\.z, lightParams\.w, length\(cc_cameraPos\.xyz - v_worldPos\)\);/.test(fx)&&/\* \(waveParams\.x \* wf\)\);/.test(fx),'wave fade');
const bd=dist([0,0,B.max[2]]),mid=dist([0,0,-40]);assert(bd<P.waterWaveFadeEnd&&mid>P.waterWaveFadeEnd,'waves on the board water, none mid-lake');
const T=require('./water_tune_v33.cjs');// v3.3 fit model (assumes the v3.2 sRGB-byte lights) - kept for its v3.2 reproduction check only
assert.deepEqual(T.predict(T.P0,T.VCS[0]),[63,216,214],'model reproduces the Mac v3.2 pixel 64/218/216');
assert.equal(D.LAKESIDE_FOG_MODE,'layered','v3.3 default fog');
console.log('lakeside water+fog OK fogEnd='+end);
