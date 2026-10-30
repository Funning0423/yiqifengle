#!/usr/bin/env node
'use strict';
/** qf-meadow-encode: the extension's pure meta transform on the REAL committed env_meadow.glb.meta changes only
 *  /userData/meshCompress/encode, and that change (alone, and with Creator's expected 0e588 removal) passes the
 *  meta-allowlist gate in a synthetic git repo. Bad inputs are refused. Scratch: $QF_SELFTEST_TMP or os.tmpdir(). */
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert');
const ROOT=path.resolve(__dirname,'../..');
const {transformMeta}=require('./qf-meadow-encode/transform.js');
const MA=require('../build-guard/meta-allowlist.cjs');
const REL='creator-build-project/assets/bundles/region_meadow/env_meadow.glb.meta';
// Input = the pre-encode meta. Once the Mac-produced (encoded) meta is committed, read it from the allowlist base.
let real=JSON.parse(fs.readFileSync(path.join(ROOT,REL),'utf8'));
if(real.userData.meshCompress.encode===true){const AL=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/build-guard/meta-allowlist.json'),'utf8'));
  const base=cp.execFileSync('git',['merge-base','HEAD',AL.baseRef||'ggbot/full9c-final'],{cwd:ROOT,encoding:'utf8'}).trim();
  real=JSON.parse(cp.execFileSync('git',['show',base+':'+REL],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<24}));}
const {meta:out,changed}=transformMeta(real);
const d=MA.diff(real,out);
assert.ok(changed);assert.deepStrictEqual(d,[{op:'replace',path:'/userData/meshCompress/encode',from:false,to:true}]);
assert.equal(real.userData.meshCompress.encode,false,'input not mutated');
assert.deepStrictEqual(transformMeta(out).changed,false,'idempotent');
for(const bad of [{...real,uuid:'x'},{...real,userData:{...real.userData,meshCompress:{...real.userData.meshCompress,quantize:true}}},{...real,userData:{...real.userData,meshCompress:{...real.userData.meshCompress,compress:false}}},null])
  assert.throws(()=>transformMeta(bad));
const tmp=fs.mkdtempSync(path.join(process.env.QF_SELFTEST_TMP||os.tmpdir(),'qf-ext-'));
try{
  const g=(r,...a)=>cp.execFileSync('git',a,{cwd:r,encoding:'utf8'});
  const mk=()=>{const r=fs.mkdtempSync(path.join(tmp,'r'));fs.mkdirSync(path.dirname(path.join(r,REL)),{recursive:true});fs.writeFileSync(path.join(r,REL),JSON.stringify(real,null,2));g(r,'init','-q');g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','b');return r;};
  let r=mk();fs.writeFileSync(path.join(r,REL),JSON.stringify(out,null,2));let x=MA.run({root:r,base:'HEAD'});
  assert.ok(!x.fail.length&&!x.review.length,JSON.stringify(x));assert.equal(x.ok.length,1);
  r=mk();const reimp=JSON.parse(JSON.stringify(out));delete reimp.subMetas['0e588'];fs.writeFileSync(path.join(r,REL),JSON.stringify(reimp,null,2));x=MA.run({root:r,base:'HEAD'});
  assert.ok(!x.fail.length&&!x.review.length,JSON.stringify(x));assert.equal(x.ok.length,2);
  console.log('diff on real meta:',JSON.stringify(d));
  console.log('PASS qf-meadow-encode transform: only /userData/meshCompress/encode; meta-allowlist PASS (encode only, and encode + 0e588 removed); 4 bad inputs refused');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
