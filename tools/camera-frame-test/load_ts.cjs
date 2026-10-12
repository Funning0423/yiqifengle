'use strict';
/** Transpile the REAL engine-free world-r1 TypeScript sources into a temp dir and require them (CommonJS).
 * TypeScript comes from tools/qf-env.cjs (QF_TYPESCRIPT_MODULE, local or global npm). On the Mac set
 * QF_TYPESCRIPT_MODULE to Creator's bundled typescript if it is not installed globally.
 * QF_TS_TARGET=ES5: emit ES5 without downlevelIteration (closest to the Cocos loose ES5 build) - see test_es5_safety.cjs. */
const fs=require('fs'),path=require('path'),os=require('os');
const root=path.resolve(__dirname,'..','..');
function typescript(){
  try{return require('../qf-env.cjs').typescript();}catch(e){
    for(const p of [path.join(root,'..','..','character-core','lighthouse-island-astra-ultra','tools','vendor-node','node_modules','typescript')])if(fs.existsSync(p))return require(p);
    throw e;}
}
function load(files=['CameraPose','WorldFlowCore','FirstsliceRoutes','FirstsliceFacts','CharacterReference','RegionCameraData','TransitionCurves','IslandRail']){
  const ts=typescript(),src=path.join(root,'creator-build-project/assets/scripts/world-r1'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'camera-frame-test-'));
  const out={};
  for(const f of files){const file=path.join(src,f+'.ts');if(!fs.existsSync(file))continue;
    fs.writeFileSync(path.join(tmp,f+'.js'),ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:process.env.QF_TS_TARGET==='ES5'?ts.ScriptTarget.ES5:ts.ScriptTarget.ES2020,downlevelIteration:false}}).outputText);}
  for(const f of files)if(fs.existsSync(path.join(tmp,f+'.js')))out[f]=require(path.join(tmp,f+'.js'));
  out.tsVersion=ts.version;out.tmp=tmp;return out;
}
module.exports={load,root,typescript};
