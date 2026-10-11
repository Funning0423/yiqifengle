const fs=require('fs'),path=require('path'),{stripTypeScriptTypes}=require('node:module');
const modules='/workspace/shared/grok-takeover/gameplay/r4-compat-work/compiler/node_modules',babel=require(modules+'/@babel/core'),commonjs=require(modules+'/@babel/plugin-transform-modules-commonjs');
const {patchNativeUI,SOURCE}=require('../tools/patch_native_ui.cjs'),double=require('./cc-double.cjs');
const base='/workspace/shared/grok-takeover/mac-recovery/reconstructed/COCOS-FIRSTSLICE-COMPAT/creator-build-project/assets/scripts';
const cache=new Map();
function compile(source,file,extra={}){
 const stripped=stripTypeScriptTypes(source.replace(/@ccclass\([^\n]+\)\n/g,''),{mode:'transform'});
 const js=babel.transformSync(stripped,{plugins:[commonjs],configFile:false,babelrc:false}).code,mod={exports:{}};
 const req=id=>{if(id==='cc')return double.cc;if(id in extra)return extra[id];if(id.startsWith('./r4-cloud-compat'))return require(path.join(base,id));if(id==='../r4-cloud-compat/runtime/challenge-controller.js')return require(base+'/r4-cloud-compat/runtime/challenge-controller.js');if(id==='../r4-cloud-compat/adapter/cocos-port.js')return require(base+'/r4-cloud-compat/adapter/cocos-port.js');if(id==='../regional-r05/runtime/board-session-provider.js')return require('/workspace/shared/grok-takeover/parallel-development/levels-r5/revisions/v1.1-candidate/import-only/runtime/board-session-provider.js');if(id==='../NativeBoardUI')return {NativeBoardUI:loadActualUI()};const local=path.resolve(path.dirname(file),id+'.ts');return loadTS(local);};
 new Function('require','module','exports','setTimeout','clearTimeout',js)(req,mod,mod.exports,double.setTimeoutDouble,double.clearTimeoutDouble);return mod.exports;
}
function loadTS(file){if(cache.has(file))return cache.get(file);const value=compile(fs.readFileSync(file,'utf8'),file);cache.set(file,value);return value;}
let UI;function loadActualUI(){if(!UI)UI=compile(patchNativeUI(fs.readFileSync(SOURCE,'utf8')),SOURCE).NativeBoardUI;return UI;}
module.exports={loadActualUI,loadTS,double};
