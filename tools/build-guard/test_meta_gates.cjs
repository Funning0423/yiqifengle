#!/usr/bin/env node
'use strict';
/** Self-tests for meta-allowlist.cjs and manifest-files-exist.cjs on a synthetic git repo (no real asset .meta is
 *  written: fixtures are generated JSON shaped like env_meadow.glb.meta). Scratch dir: $QF_SELFTEST_TMP or os.tmpdir(). */
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert');
const MA=require('./meta-allowlist.cjs'),MF=require('./manifest-files-exist.cjs');
const AL=path.join(__dirname,'meta-allowlist.json');
const tmp=fs.mkdtempSync(path.join(process.env.QF_SELFTEST_TMP||os.tmpdir(),'qf-meta-gates-'));
const g=(r,...a)=>cp.execFileSync('git',a,{cwd:r,encoding:'utf8'});
const MEADOW='creator-build-project/assets/bundles/region_meadow/env_meadow.glb.meta';
const MAT='creator-build-project/assets/bundles/region_meadow/mat_ground.mtl.meta';
const U='bb978abb-d907-5dba-be5a-14cc64f5e596';
const baseMeta=()=>({ver:'2.3.13',importer:'gltf',imported:true,uuid:U,files:[],subMetas:{
  '0e588':{importer:'texture',uuid:U+'@0e588',displayName:'meadow_ground_detail_v0_8_512',userData:{wrapModeS:'repeat'}},
  '85da7':{importer:'gltf-mesh',uuid:U+'@85da7',userData:{gltfIndex:0}},
  'f06f9':{importer:'gltf-material',uuid:U+'@f06f9',userData:{textures:[U+'@3c858']}}},
  userData:{tangents:1,meshCompress:{enable:true,compress:true,encode:false,quantize:false}}});
const w=(r,f,o)=>{fs.mkdirSync(path.dirname(path.join(r,f)),{recursive:true});fs.writeFileSync(path.join(r,f),JSON.stringify(o,null,2));};
let n=0;
function repo(){const r=path.join(tmp,'r'+(++n));fs.mkdirSync(r);g(r,'init','-q');w(r,MEADOW,baseMeta());
  w(r,MAT,{ver:'1.0.21',importer:'material',uuid:'aaaa1111-2222-3333-4444-555566667777',userData:{tex:U+'@0e588'}});
  w(r,'creator-build-project/assets/bundles/region_meadow/other.png.meta',{ver:'1.0.0',importer:'image',uuid:'cccc1111-2222-3333-4444-555566667777'});
  g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','base');return r;}
const check=(r,al=AL,extra={})=>MA.run({root:r,base:'HEAD',allowlist:al,...extra});
const pass=x=>!x.fail.length&&!x.review.length;
const results=[];const t=(name,fn)=>{fn();results.push(name);};
try{
  const emptyAl=path.join(tmp,'empty.json');fs.writeFileSync(emptyAl,JSON.stringify({files:{},watchRefs:[],forbidBuildRefs:[]}));
  t('allowed: encode true + remove 0e588 -> PASS',()=>{const r=repo(),m=baseMeta();m.userData.meshCompress.encode=true;delete m.subMetas['0e588'];w(r,MEADOW,m);const x=check(r);assert.ok(pass(x),JSON.stringify(x));assert.equal(x.ok.length,2);});
  t('no change -> PASS',()=>{const r=repo();assert.ok(pass(check(r)));});
  t('empty allowlist + encode change -> FAIL',()=>{const r=repo(),m=baseMeta();m.userData.meshCompress.encode=true;w(r,MEADOW,m);const x=check(r,emptyAl);assert.ok(!pass(x));assert.match(x.fail.join('\n'),/NOT_ALLOWED .*\/userData\/meshCompress\/encode/);});
  t('extra field change (tangents) -> FAIL',()=>{const r=repo(),m=baseMeta();m.userData.meshCompress.encode=true;m.userData.tangents=0;w(r,MEADOW,m);const x=check(r);assert.ok(!pass(x));assert.match(x.fail.join('\n'),/NOT_ALLOWED .*\/userData\/tangents/);});
  t('quantize on -> FAIL',()=>{const r=repo(),m=baseMeta();m.userData.meshCompress.encode=true;m.userData.meshCompress.quantize=true;w(r,MEADOW,m);const x=check(r);assert.ok(!pass(x));assert.match(x.fail.join('\n'),/quantize/);assert.match(x.fail.join('\n'),/MUST_EQUAL/);});
  t('edit inside 0e588 instead of removing it -> FAIL (NEEDS_REVIEW)',()=>{const r=repo(),m=baseMeta();m.subMetas['0e588'].userData.wrapModeS='clamp';w(r,MEADOW,m);const x=check(r);assert.ok(!pass(x));assert.match(x.review.join('\n'),/NEEDS_REVIEW .*0e588/);});
  t('material .meta that used the texture changes -> FAIL (NEEDS_REVIEW)',()=>{const r=repo();w(r,MAT,{ver:'1.0.21',importer:'material',uuid:'aaaa1111-2222-3333-4444-555566667777',userData:{tex:null}});const x=check(r);assert.ok(!pass(x));assert.match(x.review.join('\n'),/NEEDS_REVIEW .*mat_ground/);});
  t('added .meta -> FAIL',()=>{const r=repo();w(r,'creator-build-project/assets/bundles/region_meadow/new.png.meta',{uuid:'dddd'});const x=check(r);assert.match(x.fail.join('\n'),/META_ADDED/);});
  t('added .meta (committed) -> FAIL',()=>{const r=repo();w(r,'creator-build-project/assets/x.meta',{uuid:'eeee'});g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','add');const x=MA.run({root:r,base:'HEAD~1',allowlist:AL});assert.match(x.fail.join('\n'),/META_ADDED/);});
  t('deleted .meta -> FAIL',()=>{const r=repo();fs.unlinkSync(path.join(r,'creator-build-project/assets/bundles/region_meadow/other.png.meta'));const x=check(r);assert.match(x.fail.join('\n'),/META_DELETED/);});
  t('uuid change -> FAIL',()=>{const r=repo(),m=baseMeta();m.uuid='bb978abb-0000-0000-0000-000000000000';w(r,MEADOW,m);const x=check(r);assert.match(x.fail.join('\n'),/UUID_CHANGED/);});
  t('sub-asset uuid change -> FAIL',()=>{const r=repo(),m=baseMeta();m.subMetas['85da7'].uuid=U+'@99999';w(r,MEADOW,m);assert.ok(!pass(check(r)));});
  fs.writeFileSync(path.join(tmp,'nobase.json'),JSON.stringify({baseRef:'no/such-branch',files:{}}));
  t('missing base ref -> FAIL',()=>{const r=repo();const x=MA.run({root:r,allowlist:path.join(tmp,'nobase.json')});assert.match(x.fail.join('\n'),/NO_BASE/);});
  t('build output still has @0e588 after removal -> FAIL; clean -> PASS; before removal -> pending INFO',()=>{
    const r=repo(),m=baseMeta();m.userData.meshCompress.encode=true;delete m.subMetas['0e588'];
    const bd=path.join(tmp,'build'),b=path.join(bd,'subpackages/region_meadow');fs.mkdirSync(path.join(b,'native/bb'),{recursive:true});
    fs.writeFileSync(path.join(b,'config.json'),JSON.stringify({uuids:['bbl4q72Qddur5aFMxk9eWW@0e588','bbl4q72Qddur5aFMxk9eWW@85da7']}));
    let x=check(r,AL,{buildDir:bd});assert.ok(pass(x),'pending before removal');assert.match(x.info.join('\n'),/BUILD_REF_PENDING/);
    w(r,MEADOW,m);x=check(r,AL,{buildDir:bd});assert.match(x.fail.join('\n'),/BUILD_REF .*bbl4q72Qddur5aFMxk9eWW@0e588/);
    fs.writeFileSync(path.join(b,'config.json'),JSON.stringify({uuids:['bbl4q72Qddur5aFMxk9eWW@85da7']}));fs.writeFileSync(path.join(b,'native/bb',U+'@0e588.jpg'),'x');
    x=check(r,AL,{buildDir:bd});assert.match(x.fail.join('\n'),/file name has/);
    fs.unlinkSync(path.join(b,'native/bb',U+'@0e588.jpg'));x=check(r,AL,{buildDir:bd});assert.ok(pass(x),JSON.stringify(x));});
  // manifest-files-exist
  t('manifest: all listed files exist -> PASS',()=>{const r=repo();fs.writeFileSync(path.join(r,'m.json'),JSON.stringify([{path:MEADOW}]));g(r,'add','m.json');assert.equal(MF.run({root:r,manifests:['m.json']}).fail.length,0);});
  t('manifest: synthetic missing entry -> FAIL',()=>{const r=repo();fs.writeFileSync(path.join(r,'m.json'),JSON.stringify([{path:MEADOW},{path:'creator-build-project/assets/bundles/static_seat_preview/actor/user_static_seated_2k.glb'}]));const x=MF.run({root:r,manifests:['m.json']});assert.match(x.fail.join('\n'),/MISSING_FILE .*user_static_seated_2k/);});
  t('manifest: untracked file -> FAIL',()=>{const r=repo();fs.writeFileSync(path.join(r,'loose.glb'),'x');fs.writeFileSync(path.join(r,'m.json'),JSON.stringify([{path:'loose.glb'}]));assert.match(MF.run({root:r,manifests:['m.json']}).fail.join('\n'),/NOT_TRACKED/);});
  t('manifest: asset missing from build bundle -> FAIL; present -> PASS',()=>{const r=repo();const glb='creator-build-project/assets/bundles/region_meadow/env_meadow.glb';fs.writeFileSync(path.join(r,glb),'glb');g(r,'add','-A');
    fs.writeFileSync(path.join(r,'m.json'),JSON.stringify([{path:glb}]));const bd=path.join(tmp,'b2'),b=path.join(bd,'subpackages/region_meadow');fs.mkdirSync(b,{recursive:true});
    fs.writeFileSync(path.join(b,'config.json'),JSON.stringify({uuids:['zz']}));assert.match(MF.run({root:r,manifests:['m.json'],buildDir:bd}).fail.join('\n'),/NOT_IN_BUILD/);
    fs.writeFileSync(path.join(b,'config.json'),JSON.stringify({uuids:['bbl4q72Qddur5aFMxk9eWW@85da7']}));assert.equal(MF.run({root:r,manifests:['m.json'],buildDir:bd}).fail.length,0);
    assert.match(MF.run({root:r,manifests:['m.json'],buildDir:path.join(tmp,'nobuild')}).fail.join('\n'),/BUNDLE_NOT_IN_BUILD/);});
  console.log(results.map(x=>'ok - '+x).join('\n'));console.log(`PASS meta-gates selftest ${results.length} cases`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
