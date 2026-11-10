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
  userData:{imageMetas:[{name:'meadow_palette_256',uri:U+'@d3bf8'},{name:'meadow_ground_detail_v0_8_512',uri:U+'@0e588'},{name:'meadow_sky',uri:U+'@9d104'}],tangents:1,meshCompress:{enable:true,compress:true,encode:false,quantize:false}}});
const w=(r,f,o)=>{fs.mkdirSync(path.dirname(path.join(r,f)),{recursive:true});fs.writeFileSync(path.join(r,f),JSON.stringify(o,null,2));};
let n=0;
function repo(){const r=path.join(tmp,'r'+(++n));fs.mkdirSync(r);g(r,'init','-q');w(r,MEADOW,baseMeta());
  w(r,MAT,{ver:'1.0.21',importer:'material',uuid:'aaaa1111-2222-3333-4444-555566667777',userData:{tex:U+'@0e588'}});
  w(r,'creator-build-project/assets/bundles/region_meadow/other.png.meta',{ver:'1.0.0',importer:'image',uuid:'cccc1111-2222-3333-4444-555566667777'});
  g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','base');return r;}
const check=(r,al=AL,extra={})=>MA.run({root:r,base:'HEAD',allowlist:al,...extra});
const pass=x=>!x.fail.length&&!x.review.length;
const results=[];const t=(name,fn)=>{fn();results.push(name);};
function withEnv(key,value,fn){const prev=process.env[key];if(value===undefined)delete process.env[key];else process.env[key]=value;try{return fn();}finally{if(prev===undefined)delete process.env[key];else process.env[key]=prev;}}
try{
  const emptyAl=path.join(tmp,'empty.json');fs.writeFileSync(emptyAl,JSON.stringify({files:{},watchRefs:[],forbidBuildRefs:[]}));
  t('allowed: encode true + remove 0e588 -> PASS',()=>{const r=repo(),m=baseMeta();m.userData.meshCompress.encode=true;delete m.subMetas['0e588'];w(r,MEADOW,m);const x=check(r);assert.ok(pass(x),JSON.stringify(x));assert.equal(x.ok.length,2);});
  const dropIM=(m,name)=>{m.userData.imageMetas=m.userData.imageMetas.filter(x=>x.name!==name);};
  t('allowed: Mac shape (encode + remove 0e588 + drop its imageMetas item) -> PASS',()=>{const r=repo(),m=baseMeta();m.userData.meshCompress.encode=true;delete m.subMetas['0e588'];dropIM(m,'meadow_ground_detail_v0_8_512');w(r,MEADOW,m);const x=check(r);assert.ok(pass(x),JSON.stringify(x));assert.equal(x.ok.length,3);});
  t('narrow: removing a different imageMetas item -> FAIL',()=>{const r=repo(),m=baseMeta();dropIM(m,'meadow_sky');w(r,MEADOW,m);assert.ok(!pass(check(r)));});
  t('narrow: removing 0e588 item AND another item -> FAIL',()=>{const r=repo(),m=baseMeta();dropIM(m,'meadow_ground_detail_v0_8_512');dropIM(m,'meadow_sky');w(r,MEADOW,m);assert.ok(!pass(check(r)));});
  t('narrow: 0e588 item removed but another item edited -> FAIL',()=>{const r=repo(),m=baseMeta();dropIM(m,'meadow_ground_detail_v0_8_512');m.userData.imageMetas[0].uri=U+'@00000';w(r,MEADOW,m);assert.ok(!pass(check(r)));});
  t('narrow: same imageMetas removal in another file -> FAIL/NEEDS_REVIEW',()=>{const r=repo(),o='creator-build-project/assets/bundles/region_meadow/other.glb.meta',mk=()=>({uuid:'ffff1111-2222-3333-4444-555566667777',userData:{imageMetas:[{name:'a',uri:'x@1'},{name:'meadow_ground_detail_v0_8_512',uri:U+'@0e588'}]}});
    w(r,o,mk());g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','o');const m=mk();m.userData.imageMetas.pop();w(r,o,m);const x=check(r);assert.ok(!pass(x));assert.ok((x.fail.length+x.review.length)>0);});
  t('sea metas: allowAdd with importer gltf -> PASS; wrong importer -> FAIL',()=>{const r=repo(),S='creator-build-project/assets/bundles/transport_sail/';w(r,S+'far_meadow_impostor.glb.meta',{importer:'gltf',uuid:'1'});w(r,S+'sea_reef_cluster.glb.meta',{importer:'gltf',uuid:'2'});assert.ok(pass(check(r)));
    w(r,S+'sea_reef_cluster.glb.meta',{importer:'image',uuid:'2'});assert.match(check(r).fail.join('\n'),/META_ADDED .*importer image/);w(r,S+'sea_reef_cluster.glb.meta',{importer:'gltf',uuid:'2'});w(r,S+'other.glb.meta',{importer:'gltf',uuid:'3'});assert.match(check(r).fail.join('\n'),/META_ADDED .*other\.glb/);});
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
  t('no integration ref and no 95dc672d -> NO_BASE (stale allowlist baseRef is ignored)',()=>{
    const r=repo();
    const stale=path.join(tmp,'stale-baseref.json');
    fs.writeFileSync(stale,JSON.stringify({baseRef:'ggbot/full9c-final',files:{}}));
    withEnv('META_ALLOWLIST_BASE',undefined,()=>{
      const x=MA.run({root:r,allowlist:stale});
      assert.equal(x.base,null);
      assert.match(x.fail.join('\n'),/NO_BASE: cannot resolve merge-base with origin\/gbt\/r5-b20-integrate-landing-visual-bg2 or gbt\/r5-b20-integrate-landing-visual-bg2, and 95dc672d is missing/);
    });
  });
  const INTEGRATION='gbt/r5-b20-integrate-landing-visual-bg2';
  const LEGIT='creator-build-project/assets/bundles/region_meadow/legit_on_integration.png.meta';
  t('unset base on a branch off the integration branch uses origin merge-base; an unknown meta still fails',()=>{
    const r=repo();
    w(r,LEGIT,{importer:'image',uuid:'11111111-2222-3333-4444-555566667777'});
    g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','integration adds meta');
    const integration=g(r,'rev-parse','HEAD').trim();
    const rootCommit=g(r,'rev-parse','HEAD~1').trim();
    g(r,'branch',INTEGRATION,integration);
    g(r,'update-ref','refs/remotes/origin/'+INTEGRATION,integration);
    g(r,'checkout','-q','-b','feature/off-integration');
    fs.writeFileSync(path.join(r,'note.txt'),'feature\n');
    g(r,'add','note.txt');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','feature work');
    withEnv('META_ALLOWLIST_BASE',undefined,()=>{
      const x=MA.run({root:r,allowlist:AL});
      assert.ok(pass(x),JSON.stringify(x));
      assert.equal(x.base,integration);
      assert.equal(x.baseSource,'merge-base HEAD origin/'+INTEGRATION);
      assert.match(x.info.join('\n'),new RegExp('base chosen: merge-base HEAD origin/'+INTEGRATION.replace(/[.]/g,'\\.')+' -> '+integration));
      const sneaky='creator-build-project/assets/bundles/region_meadow/sneaky.png.meta';
      w(r,sneaky,{uuid:'sneaky'});
      const y=MA.run({root:r,allowlist:AL});
      assert.equal(y.base,integration);
      assert.match(y.fail.join('\n'),/META_ADDED .*sneaky\.png\.meta/);
      fs.unlinkSync(path.join(r,sneaky));
      const env=Object.assign({},process.env);delete env.META_ALLOWLIST_BASE;
      const out=cp.execFileSync(process.execPath,[path.join(__dirname,'meta-allowlist.cjs'),'--root',r],{cwd:r,encoding:'utf8',env});
      assert.match(out,/INFO base chosen: merge-base HEAD origin\/gbt\/r5-b20-integrate-landing-visual-bg2 -> /);
      assert.match(out,/PASS meta-allowlist base=/);
    });
  });
  t('explicit META_ALLOWLIST_BASE and --base override the integration default',()=>{
    const r=repo();
    w(r,LEGIT,{importer:'image',uuid:'11111111-2222-3333-4444-555566667777'});
    g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','integration adds meta');
    const integration=g(r,'rev-parse','HEAD').trim();
    const rootCommit=g(r,'rev-parse','HEAD~1').trim();
    g(r,'update-ref','refs/remotes/origin/'+INTEGRATION,integration);
    g(r,'checkout','-q','-b','feature/override');
    withEnv('META_ALLOWLIST_BASE',rootCommit,()=>{
      const z=MA.run({root:r,allowlist:AL});
      assert.equal(z.base,rootCommit);
      assert.equal(z.baseSource,'META_ALLOWLIST_BASE');
      assert.match(z.info.join('\n'),new RegExp('base chosen: META_ALLOWLIST_BASE -> '+rootCommit));
      assert.match(z.fail.join('\n'),/META_ADDED .*legit_on_integration/);
      const over=MA.run({root:r,base:'HEAD',allowlist:AL});
      assert.equal(over.base,'HEAD');
      assert.equal(over.baseSource,'--base');
      assert.ok(pass(over),JSON.stringify(over));
    });
  });
  t('missing remote integration ref falls back to the local branch',()=>{
    const r=repo();
    w(r,LEGIT,{importer:'image',uuid:'11111111-2222-3333-4444-555566667777'});
    g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','integration adds meta');
    const integration=g(r,'rev-parse','HEAD').trim();
    const rootCommit=g(r,'rev-parse','HEAD~1').trim();
    g(r,'branch',INTEGRATION,rootCommit);
    g(r,'update-ref','refs/remotes/origin/'+INTEGRATION,integration);
    g(r,'checkout','-q','-b','feature/no-remote');
    withEnv('META_ALLOWLIST_BASE',undefined,()=>{
      const remoteWins=MA.run({root:r,allowlist:AL});
      assert.equal(remoteWins.base,integration);
      assert.equal(remoteWins.baseSource,'merge-base HEAD origin/'+INTEGRATION);
      assert.ok(pass(remoteWins),JSON.stringify(remoteWins));
      g(r,'update-ref','-d','refs/remotes/origin/'+INTEGRATION);
      const local=MA.run({root:r,allowlist:AL});
      assert.equal(local.base,rootCommit);
      assert.equal(local.baseSource,'merge-base HEAD '+INTEGRATION);
      assert.match(local.info.join('\n'),/base chosen: merge-base HEAD gbt\/r5-b20-integrate-landing-visual-bg2 -> /);
      assert.ok(!local.baseSource.includes('origin/'));
      assert.match(local.fail.join('\n'),/META_ADDED .*legit_on_integration/);
    });
  });
  t('missing remote and local integration refs fall back to 95dc672d',()=>{
    const real=path.resolve(__dirname,'../..');
    const full=g(real,'rev-parse','95dc672d^{commit}').trim();
    const r=path.join(tmp,'fallback-pin');fs.mkdirSync(r);
    g(r,'init','-q');
    const objects=cp.execFileSync('git',['rev-parse','--absolute-git-dir'],{cwd:real,encoding:'utf8'}).trim();
    fs.mkdirSync(path.join(r,'.git','objects','info'),{recursive:true});
    fs.writeFileSync(path.join(r,'.git','objects','info','alternates'),path.join(objects,'objects')+'\n');
    fs.writeFileSync(path.join(r,'README'),'seed\n');
    g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','seed');
    withEnv('META_ALLOWLIST_BASE',undefined,()=>{
      const x=MA.run({root:r,allowlist:AL});
      assert.equal(x.baseSource,'fallback 95dc672d');
      assert.equal(x.base,full);
      assert.match(x.info.join('\n'),new RegExp('base chosen: fallback 95dc672d -> '+full));
      assert.match(x.fail.join('\n'),/META_DELETED creator-build-project\/assets\/bundles\/region_transit_balloon\/transport_balloon\.glb\.meta/);
    });
  });
  t('build output still has @0e588 after removal -> FAIL; clean -> PASS; before removal -> pending INFO',()=>{
    const r=repo(),m=baseMeta();m.userData.meshCompress.encode=true;delete m.subMetas['0e588'];
    const bd=path.join(tmp,'build'),b=path.join(bd,'subpackages/region_meadow');fs.mkdirSync(path.join(b,'native/bb'),{recursive:true});
    fs.writeFileSync(path.join(b,'config.json'),JSON.stringify({uuids:['bbl4q72Qddur5aFMxk9eWW@0e588','bbl4q72Qddur5aFMxk9eWW@85da7']}));
    let x=check(r,AL,{buildDir:bd});assert.ok(pass(x),'pending before removal');assert.match(x.info.join('\n'),/BUILD_REF_PENDING/);
    w(r,MEADOW,m);x=check(r,AL,{buildDir:bd});assert.match(x.fail.join('\n'),/BUILD_REF .*bbl4q72Qddur5aFMxk9eWW@0e588/);
    fs.writeFileSync(path.join(b,'config.json'),JSON.stringify({uuids:['bbl4q72Qddur5aFMxk9eWW@85da7']}));fs.writeFileSync(path.join(b,'native/bb',U+'@0e588.jpg'),'x');
    x=check(r,AL,{buildDir:bd});assert.match(x.fail.join('\n'),/file name has/);
    fs.unlinkSync(path.join(b,'native/bb',U+'@0e588.jpg'));x=check(r,AL,{buildDir:bd});assert.ok(pass(x),JSON.stringify(x));});
  // Balloon metas already in the pin are not changes against an older base. An edit, or a non-balloon meta, still fails.
  t('balloon metas identical to the pin are not changes; an edit or another meta still fails',()=>{
    const r=repo();
    const TB='creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb.meta';
    const clouds='creator-build-project/assets/bundles/region_transit_balloon/transit_clouds_merged.glb.meta';
    const night='creator-build-project/assets/bundles/region_transit_balloon/transit_night_dome.glb.meta';
    const sea='creator-build-project/assets/bundles/region_transit_balloon/transit_sea_fallback.glb.meta';
    const BD='creator-build-project/assets/scripts/region/BalloonDrape.ts.meta';
    const oldTB={ver:'2.3.14',importer:'gltf',uuid:'5c12e899-95e9-4fd1-90d1-3c7bf293a963',subMetas:{'79340':{importer:'gltf-mesh',ver:'1.1.1',userData:{gltfIndex:0,triangleCount:545}}},userData:{assetFinder:{meshes:['5c12e899-95e9-4fd1-90d1-3c7bf293a963@79340']}}};
    const pinTB=JSON.parse(JSON.stringify(oldTB));
    pinTB.subMetas['79340'].userData.triangleCount=324;
    pinTB.subMetas.a4c17={importer:'gltf-mesh',ver:'1.1.1',id:'a4c17',name:'balloon_load_frame.mesh',userData:{gltfIndex:4,triangleCount:221}};
    pinTB.userData.assetFinder.meshes.push('5c12e899-95e9-4fd1-90d1-3c7bf293a963@a4c17');
    w(r,TB,oldTB);g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','old-balloon');
    w(r,TB,pinTB);
    for(const f of [clouds,night,sea])w(r,f,{ver:'2.3.14',importer:'gltf',uuid:f});
    w(r,BD,{ver:'4.0.24',importer:'typescript',uuid:'b7e4c1a2-6d08-4f3e-9a55-2c8f0e91d4ab'});
    g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','pin');
    const pin=g(r,'rev-parse','HEAD').trim();
    const prev=process.env.META_BALLOON_BASELINE;process.env.META_BALLOON_BASELINE=pin;
    try{
      const x=MA.run({root:r,base:'HEAD~1',allowlist:AL});
      assert.ok(pass(x),JSON.stringify(x));
      const info=x.info.join('\n');
      for(const f of [TB,clouds,night,sea,BD])assert.match(info,new RegExp('BASELINE_95dc672d '+f.replace(/[.]/g,'\\.')+' matches'));
      assert.equal(x.fail.length,0);
      const edited=JSON.parse(JSON.stringify(pinTB));edited.ver='9.9.9';w(r,TB,edited);
      const y=MA.run({root:r,base:'HEAD~1',allowlist:AL});
      assert.ok(!pass(y));assert.match(y.fail.join('\n'),/transport_balloon\.glb\.meta/);
      w(r,TB,pinTB);
      const meadow=JSON.parse(fs.readFileSync(path.join(r,MEADOW),'utf8'));meadow.userData.tangents=0;w(r,MEADOW,meadow);
      const z=MA.run({root:r,base:'HEAD~1',allowlist:AL});
      assert.ok(!pass(z));assert.match(z.fail.join('\n'),/NOT_ALLOWED .*\/userData\/tangents/);
      assert.ok(!z.fail.join('\n').includes('transit_clouds_merged'));
    }finally{if(prev===undefined)delete process.env.META_BALLOON_BASELINE;else process.env.META_BALLOON_BASELINE=prev;}
  });
  t('real tree: balloon metas already in 95dc672d are not changes vs the full9c-era base',()=>{
    const root=path.resolve(__dirname,'../..');
    cp.execFileSync('git',['cat-file','-e','19bd812a^{commit}'],{cwd:root});
    cp.execFileSync('git',['cat-file','-e','95dc672d^{commit}'],{cwd:root});
    const x=MA.run({root,base:'19bd812a'});
    assert.ok(pass(x),x.fail.concat(x.review).join('\n'));
    const info=x.info.join('\n');
    assert.match(info,/BASELINE_95dc672d creator-build-project\/assets\/bundles\/region_transit_balloon\/transport_balloon\.glb\.meta matches 95dc672d/);
    assert.match(info,/BASELINE_95dc672d creator-build-project\/assets\/scripts\/region\/BalloonDrape\.ts\.meta matches 95dc672d/);
    assert.equal(x.fail.length,0);
  });
  // manifest-files-exist
  t('manifest: all listed files exist -> PASS',()=>{const r=repo();fs.writeFileSync(path.join(r,'m.json'),JSON.stringify([{path:MEADOW}]));g(r,'add','m.json');assert.equal(MF.run({root:r,manifests:['m.json']}).fail.length,0);});
  t('manifest: synthetic missing entry -> FAIL',()=>{const r=repo();fs.writeFileSync(path.join(r,'m.json'),JSON.stringify([{path:MEADOW},{path:'creator-build-project/assets/bundles/static_seat_preview/actor/user_static_seated_2k.glb'}]));const x=MF.run({root:r,manifests:['m.json']});assert.match(x.fail.join('\n'),/MISSING_FILE .*user_static_seated_2k/);});
  t('manifest: untracked file -> FAIL',()=>{const r=repo();fs.writeFileSync(path.join(r,'loose.glb'),'x');fs.writeFileSync(path.join(r,'m.json'),JSON.stringify([{path:'loose.glb'}]));assert.match(MF.run({root:r,manifests:['m.json']}).fail.join('\n'),/NOT_TRACKED/);});
  t('manifest: asset missing from build bundle -> FAIL; present -> PASS',()=>{const r=repo();const glb='creator-build-project/assets/bundles/region_meadow/env_meadow.glb';fs.writeFileSync(path.join(r,glb),'glb');g(r,'add','-A');
    fs.writeFileSync(path.join(r,'m.json'),JSON.stringify([{path:glb}]));const bd=path.join(tmp,'b2'),b=path.join(bd,'subpackages/region_meadow');fs.mkdirSync(b,{recursive:true});
    fs.writeFileSync(path.join(b,'config.json'),JSON.stringify({uuids:['zz']}));assert.match(MF.run({root:r,manifests:['m.json'],buildDir:bd}).fail.join('\n'),/NOT_IN_BUILD/);
    fs.writeFileSync(path.join(b,'config.json'),JSON.stringify({uuids:['bbl4q72Qddur5aFMxk9eWW@85da7']}));assert.equal(MF.run({root:r,manifests:['m.json'],buildDir:bd}).fail.length,0);
    assert.match(MF.run({root:r,manifests:['m.json'],buildDir:path.join(tmp,'nobuild')}).fail.join('\n'),/BUNDLE_NOT_IN_BUILD/);});
  t('no .meta files -> NO_TARGETS',()=>{
    const r=path.join(tmp,'nometas');fs.mkdirSync(r);g(r,'init','-q');fs.writeFileSync(path.join(r,'README'),'x\n');
    g(r,'add','-A');g(r,'-c','user.name=t','-c','user.email=t@t','commit','-qm','empty');
    const x=MA.run({root:r,base:'HEAD',allowlist:AL});
    assert.equal(x.targets,0);assert.match(x.fail.join('\n'),/NO_TARGETS: meta-allowlist scanned 0/);
  });
  t('empty manifests -> NO_TARGETS',()=>{
    const r=repo();
    fs.writeFileSync(path.join(r,'assets-MANIFEST-SHA256.json'),'[]\n');
    fs.writeFileSync(path.join(r,'text-MANIFEST-SHA256.json'),'[]\n');
    const x=MF.run({root:r});
    assert.equal(x.entries,0);assert.match(x.fail.join('\n'),/NO_TARGETS: manifest-files-exist scanned 0 entries/);
  });
  t('meta gate copied outside the repo follows cwd toplevel and REPO_ROOT',()=>{
    const r=repo();w(r,'creator-build-project/assets/sneaky-outside.meta',{uuid:'abcd'});
    const outside=path.join(tmp,'outside-meta');fs.mkdirSync(outside);
    for(const f of ['meta-allowlist.cjs','lib-gates.cjs','meta-allowlist.json'])fs.copyFileSync(path.join(__dirname,f),path.join(outside,f));
    const env=Object.assign({},process.env);env.META_ALLOWLIST_BASE='HEAD';delete env.REPO_ROOT;
    const runAt=(cwd,extraEnv)=>{let out='';try{out=cp.execFileSync(process.execPath,[path.join(outside,'meta-allowlist.cjs')],{cwd,encoding:'utf8',env:Object.assign({},env,extraEnv)});}catch(e){out=(e.stdout||'')+(e.stderr||'');}return out;};
    const fromCwd=runAt(r,{});
    assert.match(fromCwd,/META_ADDED .*sneaky-outside\.meta/);
    const elsewhere=path.join(tmp,'not-a-worktree');fs.mkdirSync(elsewhere);
    const fromEnv=runAt(elsewhere,{REPO_ROOT:r});
    assert.match(fromEnv,/META_ADDED .*sneaky-outside\.meta/);
    const missing=runAt(elsewhere,{});
    assert.match(missing,/NO_ROOT/);
  });
  console.log(results.map(x=>'ok - '+x).join('\n'));console.log(`PASS meta-gates selftest ${results.length} cases`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
