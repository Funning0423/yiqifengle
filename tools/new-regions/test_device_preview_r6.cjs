'use strict';
// journal r6 device-preview flavour (Funning's phone QR check) — gate device-preview-r6.
//  A. runtime (harness): flag off (repo) = no qfPre default, no journal button, journal layout identical; flag on (what
//     preview-flavor.cjs produces) = qfPre defaults to journal-sky-gated (explicit ?qfPre still wins; WeChat release env → null),
//     journal shows the small day/night button inside the screen (≥ 8 pt from every edge, 320/375/390/414) and a tap toggles
//     day/night without closing the book.
//  B. production strip: after the preview flip, strip-probes (trial and --formal) removes the flag, the default and the button
//     from PreTransitionKeys.ts / IslandJourneyOverlay.ts; release-gates --probe-free passes on stripped text and FAILS on the
//     unstripped preview text (negative); the repo flag is false.
//  C. build scripts (dry run, no Creator): QF_PREVIEW=1 refused with STRIP_PROBES=1 / FORMAL_RELEASE=1 and by
//     build-production-upload.sh; QF_PREVIEW=1 STRIP_PROBES=0 with a fake Creator builds from a flipped stage → build/<out>-preview
//     carries the flag, the repo stays clean, and the normal output path is untouched.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os');
const ROOT=path.resolve(__dirname,'../..'),SRC=path.join(ROOT,'creator-build-project/assets/scripts/world-r2');
const SP=require('../build-guard/strip-probes.cjs'),RG=require('../build-guard/release-gates.cjs'),PF=require('../build-guard/preview-flavor.cjs');
const {createHarness}=require('../board-ui/harness.cjs');
(async()=>{const out=[];
// ---- A. runtime
const H=createHarness(),cc=H.cc,K=H.load('world-r2/PreTransitionKeys'),{IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay'),{resetUiNightWeight}=H.load('ui/NightTint');
assert.equal(K.QF_DEVICE_PREVIEW,false,'repo flag is false');
assert.equal(K.preTransitionKey('',{}),null,'flag off: no qfPre default');
const box=(n,W,Hh)=>{const t=n.getComponent(cc.UITransform),p=n.worldPosition,s=n.worldScale,w=t.width*Math.abs(s.x),h=t.height*Math.abs(s.y);const cx=p.x+W/2;return {x0:cx-w*t.anchorX,x1:cx+w*(1-t.anchorX),y0:Hh/2-p.y-h*(1-t.anchorY),y1:Hh/2-p.y+h*t.anchorY};};
const all=(root,W,Hh)=>{const r=[];const walk=(n,pa)=>{const t=n.getComponent(cc.UITransform);if(t&&n.activeInHierarchy&&n.name!=='qfPreviewDayNight')r.push([pa,JSON.stringify(box(n,W,Hh))]);for(const c of n.children)if(c.name!=='qfPreviewDayNight')walk(c,pa+'/'+c.name);};walk(root,root.name);return r;};
async function journal(W,Hh,on){let mode='day',toggles=0;globalThis.__worldDayNight={snapshot:()=>({mode})};resetUiNightWeight();K.QF_DEVICE_PREVIEW=on;
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:Array.from({length:12},(_,i)=>({bestStars:i<10?1:0}))}}),gates:()=>({r5:[],challenges:{},stages:[],r4:[{unlocked:true}]}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){toggles++;mode=mode==='day'?'night':'day';},dayNight:()=>({mode})});
  await H.flush();o.sync(W,Hh,true);o.open('journal');await H.flush();const p=o.popups.find('JourneyPanel');for(let i=0;i<4;i++)p.update(1);return {o,p,toggles:()=>toggles,mode:()=>mode};}
for(const [W,Hh] of [[320,568],[375,812],[390,844],[414,896]]){
  const A=await journal(W,Hh,false);assert(!A.p.root.find('qfPreviewDayNight'),W+': flag off → no button');const la=all(A.p.root,W,Hh);A.o.dispose();
  const B=await journal(W,Hh,true),b=B.p.root.find('qfPreviewDayNight');assert(b,W+': flag on → button');const lb=all(B.p.root,W,Hh);
  assert.deepEqual(lb,la,W+': rest of the journal identical with the preview button');
  const bb=box(b,W,Hh),m=Math.min(bb.x0,W-bb.x1,bb.y0,Hh-bb.y1);assert(m>=8,`${W}: button ${JSON.stringify(bb)} only ${m.toFixed(1)} pt from the screen edge`);
  const tw=bb.x1-bb.x0,th=bb.y1-bb.y0;assert(tw>=44&&th>=44,`${W}: touch target ${tw.toFixed(1)}×${th.toFixed(1)} pt < 44`);
  {const c=[[320,{left:222,right:310,top:10,bottom:42}],[375,{left:281,right:368,top:48,bottom:80}],[390,{left:297,right:384,top:51,bottom:83}],[414,{left:320,right:407,top:52,bottom:84}]].find(x=>x[0]===W)[1];assert(bb.x1<=c.left-8||bb.y0>=c.bottom+8,`${W}: button overlaps the capsule band`);}
  const icon=b.getChildByName('Face').getChildByName('Icon');assert(icon,'icon');
  H.tap(b);
  await H.flush();for(let i=0;i<4;i++)B.p.update(1);
  assert.equal(B.toggles(),1,W+': tap toggles day/night once');assert.equal(B.mode(),'night');assert(B.o.popups.find('JourneyPanel')&&B.p.alive!==false,W+': book stays open');
  out.push(`${W}x${Hh}: target ${(bb.x1-bb.x0).toFixed(1)}×${(bb.y1-bb.y0).toFixed(1)} pt, button ${bb.x0.toFixed(1)},${bb.y0.toFixed(1)}–${bb.x1.toFixed(1)},${bb.y1.toFixed(1)} (min edge ${m.toFixed(1)} pt), tap → night, ${la.length} other nodes identical`);B.o.dispose();}
K.QF_DEVICE_PREVIEW=true;
assert.equal(K.preTransitionKey('',{}),'journal-sky-gated','flag on: qfPre default');
assert.equal(K.preTransitionKey('?qfPre=journal-sky-cleared',{}),'journal-sky-cleared','explicit qfPre wins');
assert.equal(K.preTransitionKey('',{wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}})}}),null,'WeChat release env: never');
assert.equal(K.preTransitionKey('',{wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}})}}),'journal-sky-gated','WeChat develop (preview QR): default');
assert.equal(K.preTransitionEnabled('',{}),true,'flag on: hook entry enabled → auto-runs');
K.QF_DEVICE_PREVIEW=false;delete globalThis.__worldDayNight;
out.push('qfPre default: flag on → journal-sky-gated (develop), explicit key wins, release env → null; flag off → null');
// ---- B. production strip
const files={keys:fs.readFileSync(path.join(SRC,'PreTransitionKeys.ts'),'utf8'),ov:fs.readFileSync(path.join(SRC,'IslandJourneyOverlay.ts'),'utf8')};
const flipped={...files,keys:PF.flip(files.keys)};assert(flipped.keys.includes(PF.ON));assert.throws(()=>PF.flip(flipped.keys),'flip only once');
const BAD=/QF_DEVICE_PREVIEW|QF_PREVIEW_FLAG|qfPreviewDayNight|QF_DEVICE_PREVIEW_PRE|previewDayNight/;
for(const formal of [false,true]){const st=Object.entries(flipped).map(([k,t])=>({name:k,text:SP.stripAll(t,k,formal).out}));
  for(const f of st)assert(!BAD.test(f.text),`${formal?'formal':'trial'} strip leaves preview code in ${f.name}`);
  const r=RG.probeFree(st);assert.equal(r.hits.length,0,'probe-free on stripped '+(formal?'formal':'trial')+': '+JSON.stringify(r.hits.slice(0,3)));
  if(formal){const fr=RG.formalFree(st);assert.equal(fr.hits.length,0,'formal-free');}}
{const r=RG.probeFree(Object.entries(flipped).map(([k,t])=>({name:k,text:t})));const rules=new Set(r.hits.map(h=>h.rule));
 for(const s of ['QF_DEVICE_PREVIEW','QF_PREVIEW_FLAG','qfPreviewDayNight'])assert(rules.has(s),'negative: unstripped preview text must fail --probe-free on '+s+' (rules hit: '+[...rules]+')');
 out.push(`strip: trial + formal remove the flag/default/button; probe-free + formal-free PASS; negative unstripped preview: ${r.hits.length} probe-free hits (${[...rules].filter(x=>/PREVIEW|Preview/.test(x)).join(', ')})`);}
// ---- C. build scripts
const SCR=path.join(process.env.QF_SCRATCH_ROOT||path.join(os.homedir(),'wt'));fs.mkdirSync(SCR,{recursive:true});const T=fs.mkdtempSync(path.join(SCR,'qf-preview-test.'));
try{const sh=(cmd,env,cwd)=>cp.spawnSync('bash',['-c',cmd],{cwd,env:{...process.env,...env},encoding:'utf8'});
 const G=path.join(ROOT,'tools/build-guard');
 for(const env of [{QF_PREVIEW:'1',STRIP_PROBES:'1'},{QF_PREVIEW:'1',FORMAL_RELEASE:'1',STRIP_PROBES:'1'},{QF_PREVIEW:'1',STRIP_PROBES:'0',FORMAL_RELEASE:'1'}]){
  const r=sh(`bash ${G}/build-wechat-guarded.sh wechat`,{...env,CREATOR:'/nonexistent'},T);assert.notEqual(r.status,0,JSON.stringify(env));assert(/QF_PREVIEW=1 is a test build|FORMAL_RELEASE=1 needs STRIP_PROBES=1/.test(r.stdout),JSON.stringify(env)+' '+r.stdout);}
 {const r=sh(`bash ${G}/build-production-upload.sh`,{QF_PREVIEW:'1',FORMAL_RELEASE:'1',CREATOR:'/nonexistent'},T);assert.notEqual(r.status,0);assert(/PRODUCTION UPLOAD REFUSED: QF_PREVIEW=1/.test(r.stdout),r.stdout);}
 // fake-Creator preview build
 const R=path.join(T,'repo'),S=path.join(R,'creator-build-project/assets/scripts/world-r2');fs.mkdirSync(S,{recursive:true});fs.mkdirSync(path.join(R,'tools/build-guard'),{recursive:true});
 for(const f of ['build-wechat-guarded.sh','wechat-release.json','web-test.json','strip-probes.cjs','release-gates.cjs','release-probe-symbols.json','meta-allowlist.cjs','meta-allowlist.json','manifest-files-exist.cjs','lib-gates.cjs','preview-flavor.cjs'])fs.copyFileSync(path.join(G,f),path.join(R,'tools/build-guard',f));
 fs.writeFileSync(path.join(S,'PreTransitionKeys.ts'),'export const a=1;\n/*QF_PROBE_BEGIN*/export const QF_DEVICE_PREVIEW:boolean=/*QF_PREVIEW_FLAG*/false;/*QF_PROBE_END*/\n');
 fs.writeFileSync(path.join(R,'assets-MANIFEST-SHA256.json'),'[]\n');fs.writeFileSync(path.join(R,'text-MANIFEST-SHA256.json'),'[]');fs.writeFileSync(path.join(R,'.gitignore'),'build/\nlibrary/\ntemp/\ntools/build-guard/logs/\n');
 const FC=path.join(T,'fake-creator');fs.writeFileSync(FC,`#!/usr/bin/env bash
P=""; C=""; while [ $# -gt 0 ]; do case "$1" in --project) P=$2; shift;; --build) C=\${2#configPath=}; shift;; esac; shift; done
out=$(sed -n 's/.*"outputName"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' "$C" | head -1); mkdir -p "$P/build/$out/subpackages/main"
sed -e 's#/\\*QF_PREVIEW_FLAG\\*/##' "$P/assets/scripts/world-r2/PreTransitionKeys.ts" | tr -d ':' | sed 's/boolean//' > "$P/build/$out/game.js"; head -c 16000000 /dev/zero > "$P/build/$out/subpackages/main/m.bin"; echo "build Task Finished"; exit 36
`);fs.chmodSync(FC,0o755);
 assert.equal(sh('git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm init',{},R).status,0);
 const r=sh('bash tools/build-guard/build-wechat-guarded.sh wechat',{QF_PREVIEW:'1',STRIP_PROBES:'0',CREATOR:FC,SKIP_CREATOR_CHECK:'1',MAX_TRIES:'1',PRELOAD_GATE:'0',QF_STAGE_ROOT:path.join(T,'stage'),META_ALLOWLIST_BASE:'HEAD'},R);
 assert.equal(r.status,0,r.stdout+r.stderr);assert(/DEVICE PREVIEW test build/.test(r.stdout)&&/PASS preview-flavor check/.test(r.stdout),r.stdout);
 const pj=fs.readFileSync(path.join(R,'creator-build-project/build/wechat-release-preview/game.js'),'utf8');assert(/QF_DEVICE_PREVIEW\s*=\s*true/.test(pj),'preview output has flag=true: '+pj);
 assert(!fs.existsSync(path.join(R,'creator-build-project/build/wechat-release')),'normal output path not written by the preview build');
 assert.equal(sh('git status --porcelain --untracked-files=no',{},R).stdout.trim(),'','repo untouched (flag flipped only in the stage)');
 assert(fs.readFileSync(path.join(S,'PreTransitionKeys.ts'),'utf8').includes(PF.OFF),'repo flag still false');
 out.push('scripts: QF_PREVIEW refused with STRIP_PROBES=1 / FORMAL_RELEASE=1 / production upload; fake-Creator preview build → build/wechat-release-preview with flag=true, repo clean');
}finally{fs.rmSync(T,{recursive:true,force:true});}
console.log(out.join('\n'));console.log('PASS device-preview-r6');process.exit(0);
})().catch(e=>{console.error('FAIL',e&&e.stack||e);process.exit(1);});
