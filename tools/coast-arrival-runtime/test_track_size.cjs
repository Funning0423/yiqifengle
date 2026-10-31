// coast-arrival-track-size: FAIL if CoastArrivalTrack.ts source >30720 B or its minified size >30720 B.
// Minify = TypeScript transpile (ES2015/CommonJS, QF_TYPESCRIPT_MODULE) then terser
// (same convention as tools/first-screen/minify.cjs: QF_TERSER or /workspace/wt/terser; compress passes:2, mangle, no comments).
// If terser cannot be loaded, falls back to transpile + whitespace/comment strip (removeComments) and says so.
// CoastArrivalLens.ts sizes are printed for info only. Includes a negative self-test (synthetic oversized input must FAIL).
'use strict';
const fs=require('fs'),path=require('path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const LIMIT=30720;
const DIR=path.resolve(__dirname,'../../creator-build-project/assets/bundles/region_coast/scripts');
let terser=null,method;
try{terser=require(process.env.QF_TERSER||'/workspace/wt/terser/node_modules/terser');method='ts.transpile+terser';}
catch(e){method='ts.transpile(removeComments)+whitespace-strip (terser unavailable)';}
function transpile(src){return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2015,module:ts.ModuleKind.CommonJS,removeComments:true,experimentalDecorators:true}}).outputText;}
async function minSize(src){const js=transpile(src);
 if(terser){const r=await terser.minify(js,{ecma:2015,compress:{passes:2},mangle:true,format:{comments:false}});if(r.error)throw r.error;return Buffer.byteLength(r.code);}
 return Buffer.byteLength(js.split('\n').map(l=>l.trim()).filter(Boolean).join('\n'));}
async function measure(src){return {source:Buffer.byteLength(src),min:await minSize(src)};}
const ok=m=>m.source<=LIMIT&&m.min<=LIMIT;
(async()=>{
 let fail=0;
 const track=await measure(fs.readFileSync(path.join(DIR,'CoastArrivalTrack.ts'),'utf8'));
 const lens=await measure(fs.readFileSync(path.join(DIR,'CoastArrivalLens.ts'),'utf8'));
 console.log(`[coast-arrival-track-size] method=${method} limit=${LIMIT}B`);
 console.log(`  CoastArrivalTrack.ts source=${track.source}B minified=${track.min}B -> ${ok(track)?'PASS':'FAIL'}`);
 console.log(`  CoastArrivalLens.ts  source=${lens.source}B minified=${lens.min}B (info only)`);
 if(!ok(track))fail++;
 // negative self-test: synthetic oversized track (incompressible numeric table) must FAIL
 let s=1,nums=[];for(let i=0;i<6000;i++){s=(s*1103515245+12345)%2147483648;nums.push((s/2147483648*1000).toFixed(3));}
 const big=await measure(`export const T:number[]=[${nums.join(',')}];\n`);
 const negOk=!ok(big);
 console.log(`  selftest oversized source=${big.source}B minified=${big.min}B -> ${negOk?'correctly FAILS':'WRONGLY PASSES'}`);
 if(!negOk)fail++;
 const small=await measure('export const T=[1,2,3];\n');
 if(!ok(small)){console.log('  selftest small input wrongly FAILS');fail++;}
 console.log(fail?'FAIL':'PASS');process.exit(fail?1:0);
})().catch(e=>{console.error(e);console.log('FAIL');process.exit(1);});
