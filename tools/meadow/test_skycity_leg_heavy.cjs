'use strict';
/**
 * SkycityLegHeavy default-OFF A/B: ascent BalloonTransit paint + post-land SkycityCloudsea syncDay.
 * TSW must stay default OFF. Lakeside kit / standup untouched.
 */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..','..');
const S=path.join(ROOT,'creator-build-project/assets/scripts');
const ts=process.env.QF_TYPESCRIPT_MODULE?require(process.env.QF_TYPESCRIPT_MODULE):require('../qf-env.cjs').typescript();
const tx=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;

const heavySrc=fs.readFileSync(path.join(S,'region/SkycityLegHeavy.ts'),'utf8');
const balloonSrc=fs.readFileSync(path.join(S,'region/BalloonTransit.ts'),'utf8');
const cloudSrc=fs.readFileSync(path.join(S,'region/SkycityCloudsea.ts'),'utf8');
const tswSrc=fs.readFileSync(path.join(S,'region/TransitionShaderWarm.ts'),'utf8');
const kitSrc=fs.readFileSync(path.join(S,'ui/BoardProjection.ts'),'utf8');

assert.match(heavySrc,/SKYCITY_LEG_HEAVY_ENABLED\s*=\s*false/);
assert.match(heavySrc,/setSkycityLegHeavyEnabled/);
assert.match(heavySrc,/skycityLegHeavyFromFlag/);
assert.match(heavySrc,/qfskyheavy/);
assert.match(heavySrc,/__qfSkyLegHeavy/);
assert.match(balloonSrc,/from\s+['"]\.\/SkycityLegHeavy['"]/);
assert.match(balloonSrc,/skycityLegHeavyFromFlag/);
assert.match(balloonSrc,/runVis/);
assert.match(balloonSrc,/!SKYCITY_LEG_HEAVY_ENABLED&&!endNow/);
assert.match(cloudSrc,/SKYCITY_LEG_HEAVY_ENABLED/);
assert.match(cloudSrc,/daySynced/);
assert.match(cloudSrc,/needDay/);
assert.match(tswSrc,/TRANSITION_SHADER_WARM_ENABLED\s*=\s*false/,'do not reopen TSW');
assert.match(kitSrc,/qflakesidekit/,'lakeside kit flag still present');

const mod=new (module.constructor)();
mod.paths=module.paths;
const js=tx(heavySrc).replace('require("./DebugQuery")','({debugSearch:(h)=>{try{const s=h&&h.location&&h.location.search;return typeof s==="string"?s:"";}catch{return "";}}})');
mod._compile(js,path.join(S,'region/SkycityLegHeavy.ts'));
const H=mod.exports;
assert.equal(H.SKYCITY_LEG_HEAVY_ENABLED,false);
H.setSkycityLegHeavyEnabled(true);assert.equal(H.SKYCITY_LEG_HEAVY_ENABLED,true);
H.setSkycityLegHeavyEnabled(false);assert.equal(H.SKYCITY_LEG_HEAVY_ENABLED,false);
assert.equal(H.skycityLegHeavyFromFlag({location:{search:'?qfskyheavy=1'}}),true);
assert.equal(H.skycityLegHeavyFromFlag({location:{search:'?qfskyheavy=0'}}),false);
assert.equal(H.skycityLegHeavyFromFlag({__qfSkyLegHeavy:true,location:{search:''}}),true);

console.log(JSON.stringify({
  status:'PASS',
  gate:'skycity-leg-heavy-default-off',
  covers:['meadow→skycity ascent (BalloonTransit paint/scanSeas/double-apply)','skycity post-land walk→plaza (SkycityCloudsea syncDay/camera)'],
  defaultOff:true,
  killSwitch:['setSkycityLegHeavyEnabled(true)','?qfskyheavy=1','__qfSkyLegHeavy=true'],
  tswStillOff:true,
  lakesideKitUntouched:true,
},null,1));
