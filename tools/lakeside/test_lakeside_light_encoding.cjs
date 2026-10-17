// r2 (Voice Bot): lakeside light colours are converted EXACTLY ONCE. Cocos 3.8.8 reads DirectionalLight.color, Ambient sky/ground
// colours and the legacy-standard albedo (mainColor) as Color bytes/255 = LINEAR. So: params are linear (<= 1), the light call sites
// (board applyDir, journey end values = lakesideAtmosphereTarget, day AND night) and the water fallback tint use lakesideCocosLightColor
// (round(lin x 255)) and never linearToSrgb8; clear colour and fog stay sRGB. Journey end (w = 1) == board bytes in both modes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const cache=new Map(),cc={};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;
 const req=spec=>spec==='cc'?cc:load(path.resolve(path.dirname(file),spec)+'.ts');
 vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,req,m);return m.exports;}
const D=load(S+'region/LakesideSceneData.ts'),A=load(S+'region/LakesideJourneyAtmosphere.ts');
const b8=c=>[...c].map(v=>Math.round(v*255)),lum=c=>0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
// 1) contract: linear -> byte, once
for(let i=0;i<=255;i++){const x=i/255;assert.deepEqual(D.lakesideCocosLightColor([x,x,x]),[i,i,i],'byte '+i);}
assert.deepEqual(D.lakesideCocosLightColor([-1,2,NaN]),[0,255,0],'clamped, finite');
// 2) every light colour param (day + night) is authored linear (a pre-encoded or byte value would show up here)
const COLS=['sunColorLinear','ambientSkyColorLinear','ambientGroundColorLinear'];
for(const mode of ['day','night']){const M=D.lakesideModeLighting(mode);for(const k of COLS){const c=M[k];assert.equal(c.length,3);assert(c.every(v=>Number.isFinite(v)&&v>=0&&v<=1),mode+' '+k+' linear 0..1');}}
assert.deepEqual([...D.lakesideModeLighting('day').sunColorLinear],[...D.LAKESIDE_R5H3_LIGHT_LINEAR.sun],'day sun = r5h3 linear, not pre-encoded');
// 3) journey end values (w = 1) == the bytes the board writes == round(lin x 255), day and night; clear stays the sRGB hex
const base={illum:60000,color:[255,244,214],sky:[200,220,255],ground:[120,110,90],skyIllum:20000,clear:[51,51,51]};
for(const mode of ['day','night']){const M=D.lakesideModeLighting(mode),f=A.lakesideAtmosphereAt(base,1,'layered',0,mode);
 assert.deepEqual([...f.color],b8(M.sunColorLinear),mode+' journey end sun');assert.deepEqual([...f.sky],b8(M.ambientSkyColorLinear),mode+' journey end sky');
 assert.deepEqual([...f.ground],b8(M.ambientGroundColorLinear),mode+' journey end ground');assert.deepEqual([...f.clear],A.hexRgb(M.clearColor),mode+' clear colour untouched (sRGB)');
 assert.deepEqual([...f.fog.color],[...M.fogColorSrgb],mode+' fog colour untouched (sRGB)');}
// 4) sources: the light call sites convert with lakesideCocosLightColor only, never linearToSrgb8 (and never twice)
const bg=fs.readFileSync(S+'region/LakesideBoardBackground.ts','utf8'),at=fs.readFileSync(S+'region/LakesideJourneyAtmosphere.ts','utf8');
assert(/c=lakesideCocosLightColor\(M\.sunColorLinear\),sk=lakesideCocosLightColor\(M\.ambientSkyColorLinear\),gr=lakesideCocosLightColor\(M\.ambientGroundColorLinear\)/.test(bg),'board applyDir');
assert(/color:lakesideCocosLightColor\(M\.sunColorLinear\),sky:lakesideCocosLightColor\(M\.ambientSkyColorLinear\),ground:lakesideCocosLightColor\(M\.ambientGroundColorLinear\)/.test(at),'journey targets');
assert(/wc=lakesideCocosLightColor\(LAKESIDE_WATER_SKY\.day\.tintLinear\)/.test(bg),'water fallback mainColor (linear uniform)');
for(const [n,src] of [['board',bg],['journey',at]]){
 assert(!/linearToSrgb8\(\s*[MP]\.(sun|ambient|waterTint)/.test(src),n+': no sRGB encode on a light colour');
 assert(!/(linearToSrgb8|lakesideCocosLightColor)\(\s*(linearToSrgb8|lakesideCocosLightColor)\(/.test(src),n+': no stacked conversion');}
assert(!/linearToSrgb8/.test(at),'journey atmosphere has no sRGB-encoded light path left');
const sd=fs.readFileSync(S+'region/LakesideSceneData.ts','utf8');assert(!/ColorLinear:\s*lakesideCocosLightColor\(/.test(sd),'params are not pre-encoded');
// 5) night keeps the r2 night/day balance (luminance, per term) from before the fix: moon/sun 0.857, hemisphere ambient 0.219
const Dy=D.lakesideModeLighting('day'),N=D.lakesideModeLighting('night'),hemi=M=>0.5*(lum(M.ambientSkyColorLinear)+lum(M.ambientGroundColorLinear));
const sunR=lum(N.sunColorLinear)*N.sunIlluminanceScale/(lum(Dy.sunColorLinear)*Dy.sunIlluminanceScale),ambR=hemi(N)*N.ambientSkyIllumToSun/(hemi(Dy)*Dy.ambientSkyIllumToSun);
assert(Math.abs(sunR-0.857)<0.01,'night/day main light '+sunR.toFixed(3));assert(Math.abs(ambR-0.219)<0.01,'night/day ambient '+ambR.toFixed(3));
console.log('lakeside light encoding OK (sun night/day %s, ambient %s)',sunR.toFixed(3),ambR.toFixed(3));
