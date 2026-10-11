'use strict';
/** Transpile the REAL engine-free T9 sources (+ CameraPose) to CommonJS in a temp dir and require them.
 * TypeScript: $QF_TYPESCRIPT_MODULE, tools/qf-env.cjs, or work/GGbot/tools/vendor-node (pinned 5.8.3). */
const fs=require('fs'),path=require('path'),os=require('os');
const ROOT=path.resolve(__dirname,'..','..'),SRC=path.join(ROOT,'creator-build-project/assets/scripts');
function typescript(){
  const c=[process.env.QF_TYPESCRIPT_MODULE,path.join(ROOT,'tools/vendor-node/node_modules/typescript'),path.resolve(ROOT,'../GGbot/tools/vendor-node/node_modules/typescript')].filter(Boolean);
  for(const p of c)if(fs.existsSync(p))return require(p);
  try{return require('../qf-env.cjs').typescript();}catch{}
  return require('typescript');
}
function load(files=['world-r1/CameraPose','world-r2/IslandPropsLayout','world-r2/IslandPropTaps'],stubs={}){
  const ts=typescript(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'t9-props-'));
  for(const f of files){const out=path.join(tmp,f+'.js');fs.mkdirSync(path.dirname(out),{recursive:true});
    let js=ts.transpileModule(fs.readFileSync(path.join(SRC,f+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;
    for(const [from,to] of Object.entries(stubs))js=js.split(`require("${from}")`).join(`require(${JSON.stringify(to)})`);
    fs.writeFileSync(out,js);}
  const M={};for(const f of files)M[path.basename(f)]=require(path.join(tmp,f+'.js'));M.tsVersion=ts.version;M.tmp=tmp;return M;
}
module.exports={load,ROOT,SRC};
