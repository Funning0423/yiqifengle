'use strict';
/** ES5 safety guard for T2+ runtime code. The Cocos mini-game build compiles to LOOSE ES5: spreading a non-array
 * ([...map], [...set], [...map.values()], [...iterable]) becomes [].concat(x) and for-of over a Map/Set/iterator/generator
 * is not iterated (or crashes). Checks:
 *  1. TypeScript program, target ES5, downlevelIteration OFF: every iterable-spread / for-of over a non-array is a type
 *     error there (TS2802/2461/2569/2548/2549/2495); any such diagnostic in a T2+ file fails.
 *  2. Source scan: generators, Symbol.iterator, for-of over .entries()/.values()/.keys(), spread of Map/Set ctor results,
 *     and scene.getComponentInChildren (does not check the node itself) in T2+ files.
 *  3. (separate) QF_TS_TARGET=ES5 node test_camera_frames.cjs runs the whole CPU frame test on ES5 output.
 * Usage: node test_es5_safety.cjs */
const fs=require('fs'),path=require('path');const {root}=require('./load_ts.cjs');
const ts=(()=>{try{return require('../qf-env.cjs').typescript();}catch(e){return require(path.join(root,'..','..','character-core','lighthouse-island-astra-ultra','tools','vendor-node','node_modules','typescript'));}})();
const S=path.join(root,'creator-build-project/assets/scripts');
const FILES=['world-r1/WorldFlowCore.ts','world-r1/WorldFlowComponent.ts','world-r1/FirstsliceRoutes.ts','world-r1/RegionCameraData.ts',
  'world-r1/CameraPose.ts','world-r1/RoomLook.ts','WorldIntegrationBoot.ts','CharacterMotion.ts','render/DoorSpillHintCore.ts','render/DoorSpillHint.ts','render/IslandAtmosphereFxCore.ts','render/IslandAtmosphereFx.ts'].filter(f=>fs.existsSync(path.join(S,f)));
// TS2550 (ES2019 lib APIs like .flat / Object.fromEntries) is a library-availability question, not loose-ES5 iteration.
const ITER=new Set([2802,2461,2569,2548,2549,2495]);
// Cocos 3.8.8 engine types (vendored by GGbot) so cc-typed values are checked too; without it cc types are any.
const CC=[path.join(root,'..','GGbot','tools','vendor-node','node_modules','@cocos','creator-types','engine','cc.d.ts'),process.env.QF_CC_DTS||''].filter(f=>f&&fs.existsSync(f));
const prog=ts.createProgram(FILES.map(f=>path.join(S,f)).concat(CC.slice(0,1)),{target:ts.ScriptTarget.ES5,downlevelIteration:false,lib:['lib.es2017.d.ts','lib.dom.d.ts'],
  noEmit:true,strict:false,skipLibCheck:true,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.NodeJs,experimentalDecorators:true,allowJs:false,noResolve:false});
const bad=[];
for(const sf of prog.getSourceFiles()){const rel=path.relative(S,sf.fileName);if(!FILES.includes(rel))continue;
  for(const d of prog.getSemanticDiagnostics(sf).concat(prog.getSyntacticDiagnostics(sf))){if(!ITER.has(d.code))continue;
    const {line}=sf.getLineAndCharacterOfPosition(d.start||0);bad.push({file:rel,line:line+1,code:'TS'+d.code,msg:ts.flattenDiagnosticMessageText(d.messageText,' ').slice(0,140)});}}
const RX=[[/function\s*\*/,'generator'],[/Symbol\.iterator/,'Symbol.iterator'],[/for\s*\(\s*(?:const|let|var)[^;)]*\bof\b[^)]*\.(?:entries|values|keys)\(\)/,'for-of over iterator'],
  [/\.\.\.\s*(?:new\s+(?:Map|Set)\b|[\w.]+\.(?:entries|values|keys)\(\))/,'spread of iterator'],[/^(?!.*getComponent\(\s*(\w+)\s*\)\s*\|\|\s*[\w.]+\.getComponentInChildren\(\s*\1\s*\)).*getComponentInChildren\s*\(/,'getComponentInChildren without getComponent(self) first']];
for(const f of FILES){fs.readFileSync(path.join(S,f),'utf8').split('\n').forEach((l,i)=>{const code=l.replace(/\/\/.*$/,'');for(const [rx,what] of RX)if(rx.test(code))bad.push({file:f,line:i+1,code:'scan',msg:what+': '+l.trim().slice(0,100)});});}
for(const b of bad)console.log('FAIL',b.file+':'+b.line,b.code,b.msg);
console.log(bad.length?'FAILED '+bad.length:'ALL PASS es5-safety ('+FILES.length+' T2+ runtime files, TS '+ts.version+' target ES5, downlevelIteration off, cc types '+(CC.length?'on':'OFF')+')');
process.exitCode=bad.length?1:0;
