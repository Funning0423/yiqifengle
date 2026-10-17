// r4 (VB, Grok Bot): the lake ALWAYS reflects the sky - day and night - and the reflection is not the sand/orange of r3.
// Locks: skyStrength > 0, a non-zero mix floor and Fresnel, non-black reflected colours, the shader really uses them;
// night reflection is dark blue-teal (B >= G > R), day reflection above the horizon band is not warm.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const A=path.join(__dirname,'../../creator-build-project/assets');
const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path.join(A,'scripts/region/LakesideSceneData.ts'),'utf8'),{compilerOptions:{module:1,target:6}}).outputText)(m,m.exports,require);
const D=m.exports,W=D.LAKESIDE_WATER_SKY,lum=c=>0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
assert(W.shared.fresnelF0>0&&W.shared.fresnelMax>0&&W.shared.fresnelPower>0,'Fresnel on (grazing-angle reflection)');
for(const mode of ['day','night']){const M=W[mode],U=D.lakesideWaterUniforms(mode);
 assert(M.skyStrength>0&&U.fresnelParams[3]>0,mode+': sky reflection strength > 0');
 assert(M.skyReflectFloor>0&&U.specParams[3]>0,mode+': reflection mix floor > 0');
 for(const k of ['zenithLinear','lowLinear','horizonLinear'])assert(lum(M.sky[k])>0.005,mode+' '+k+' not black');}
const N=W.night.sky;for(const k of ['zenithLinear','lowLinear','horizonLinear']){const c=N[k];assert(c[2]>=c[1]&&c[1]>c[0],'night '+k+' dark blue-teal (no orange-brown)');assert(lum(c)<0.08,'night '+k+' dark');}
const Dy=W.day.sky;for(const k of ['zenithLinear','lowLinear'])assert(Dy[k][2]>Dy[k][0],'day '+k+' not warm (no sand)');
const fx=fs.readFileSync(path.join(A,'bundles/region_lakeside/water/lakeside-water.effect'),'utf8');
assert(/sky = mix\(sky, skyZenith\.rgb, smoothstep\(0\.16, 0\.38, e\)\) \* cc_ambientSky\.w \* fresnelParams\.w;/.test(fx),'reflected sky x ambient illuminance x skyStrength');
assert(/col = mix\(col, sky, clamp\(max\(F, specParams\.w\), 0\.0, fresnelParams\.z\)\);/.test(fx),'Fresnel / floor mix to the sky');
console.log('lakeside sky reflection OK (day %s, night %s)',W.day.skyStrength,W.night.skyStrength);
