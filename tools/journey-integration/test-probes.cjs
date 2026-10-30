'use strict';
// full9c test-only probes (界面验收部 acceptance): explicit her ref (every sample hits her), [QF_B1_GAP] at every cut,
// [QF_HER_FRAME] bbox/occlusion/safe area, pn= performance.now() on every probe line, and the release path runs none of it.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts/');
const mk=()=>{const H=require(path.join(ROOT,'tools/board-ui/harness.cjs')).createHarness();const cc=H.cc,on=[];
 cc.Director.EVENT_AFTER_DRAW='director_after_draw';cc.director.on=(e,f)=>on.push([e,f]);cc.director.off=(e,f)=>{const i=on.findIndex(x=>x[0]===e&&x[1]===f);if(i>=0)on.splice(i,1);};
 cc.sys.getSafeAreaRect=()=>({x:0,y:34,width:390,height:776});return {H,cc,on};};
const res={};
// ---- release path: switch off → nothing installed, nothing published, nothing logged ----
{delete global.__QF_CAM_TRACE;const {H,cc,on}=mk();const T=H.load(S+'region/CamTraceLog.ts');const out=[];T.camLog.out=s=>out.push(s);
 assert.equal(T.camLog.on,false);T.camProbeCharacter({node:new cc.Node('her')});assert.equal(global.__QF_PROBE_HER,undefined,'release: her ref published');
 T.camLogFrame({node:new cc.Node('c'),enabled:true,enabledInHierarchy:true,visibility:1<<30,worldToScreen(){}});T.camLogWrite(null,{position:[0,0,0],rotation:[0,0,0,1],fovVerticalDeg:45},'x');
 assert.equal(on.length,0,'release: draw listener installed');assert.equal(out.length,0,'release: probe output');
 const wfc=fs.readFileSync(S+'world-r1/WorldFlowComponent.ts','utf8');
 const calls=wfc.match(/camProbeCharacter\(/g).length,guarded=(wfc.match(/camLog\.on&&(?:r\.ok\)|character\))camProbeCharacter\(/g)||[]).length;assert.equal(calls,guarded,'every camProbeCharacter call must sit behind camLog.on');
 assert.match(wfc,/lateUpdate\(dt:number\):void \{if\(camLog\.on\)camLogFrame\(/,'camLogFrame only behind camLog.on');
 const src=fs.readFileSync(S+'region/CamTraceLog.ts','utf8');assert.equal((src.match(/probeHerFrame\(camera,st\.fr\)/g)||[]).length,1);
 assert.match(src,/function probeHerFrame\(camera:any,fr:number\):void\{\n if\(!camLog\.on\)return;/);assert.match(src,/export function camProbeCharacter\(adapter:any\):void\{if\(!camLog\.on\)return;/);
 for(const f of ['WorldIntegrationBoot.ts','ScreenCover.ts'])assert.ok(!fs.readFileSync(S+(f==='ScreenCover.ts'?findFile('ScreenCover.ts'):f),'utf8').includes('camProbeCharacter'),f+' touched');
 res.release={drawListeners:on.length,lines:out.length,herRef:global.__QF_PROBE_HER===undefined?'absent':'present'};}
function findFile(n){const st=[S];while(st.length){const d=st.pop();for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())st.push(p);else if(e.name===n)return path.relative(S,p);}}return n;}
// ---- test mode ----
{global.__QF_CAM_TRACE=true;const {H,cc,on}=mk();const T=H.load(S+'region/CamTraceLog.ts');const out=[];T.camLog.out=s=>out.push(s);assert.equal(T.camLog.on,true);
 // scene: cat (skinned bones) first, floating platform, her (root → skinned body). She is re-parented under the platform / vehicle per sample.
 const scene=cc.director.getScene(),cat=new cc.Node('cat'),catBones=new cc.Node('cat_bones'),plat=new cc.Node('floating_platform'),veh=new cc.Node('vehicle'),her=new cc.Node('girl_root'),body=new cc.Node('body');
 const SK=cc.SkinnedMeshRenderer||cc.MeshRenderer,mkR=(n,b)=>{const r=n.addComponent(SK);r.model={worldBounds:{center:{x:b[0],y:b[1],z:b[2]},halfExtents:{x:b[3],y:b[4],z:b[5]}}};return r;};
 cat.addChild(catBones);mkR(catBones,[3,0.3,0,.3,.3,.3]);her.addChild(body);mkR(body,[0,0.8,0,.25,.8,.25]);scene.addChild(cat);scene.addChild(plat);scene.addChild(veh);
 const old=()=>{const sk=scene.getComponentsInChildren(SK);if(!sk.length)return null;let n=sk[0].node;while(n.parent&&n.parent.getComponentsInChildren(SK).length===n.getComponentsInChildren(SK).length&&n.parent.parent)n=n.parent;return n;};
 T.camProbeCharacter({node:her});let hitNew=0,hitOld=0;const N=173;
 for(let i=0;i<N;i++){const p=[plat,veh,scene][i%3];her.removeFromParent();p.addChild(her);if(i%2){cat.removeFromParent();scene.addChild(cat);}
  if(global.__QF_PROBE_HER()===her)hitNew++;if(old()===her)hitOld++;}
 assert.equal(hitNew,N,`every sample must hit her: ${hitNew}/${N}`);res.hitRate={explicit:`${hitNew}/${N}`,oldGuess:`${hitOld}/${N}`};
 assert.ok(hitOld<N,'fixture must reproduce the old miss');
 const ap=fs.readFileSync(path.join(ROOT,'tools/wx-autoplay/qf-autoplay.js'),'utf8');assert.match(ap,/g\.__QF_PROBE_HER\(\)/);assert.doesNotMatch(ap,/getComponentsInChildren\(SKIN\)\.length===n\.getComponentsInChildren/,'old name/first-skin climb still in autoplay');
 assert.match(ap,/s\.pn=pnow\(\)/);assert.match(ap,/rec\.pn=pnow\(\);p=shot\(/,'screenshots need pn');
 // cuts: A → A → B (cut 1) → draw → C (cut 2) → draw
 const pose={position:[0,1,5],rotation:[0,0,0,1],fovVerticalDeg:45};const wr=n=>{T.camTag(n);T.camLogWrite(null,pose,'s');};
 const cam={node:Object.assign(new cc.Node('cam'),{}),enabled:true,enabledInHierarchy:true,visibility:1<<30,worldToScreen(o,w){const z=5-w.z;o.x=195+w.x/z*400;o.y=422+(w.y-1)/z*400;return o;}};cam.node.setWorldPosition?.(0,1,5);
 T.camLogFrame(cam);const draw=()=>{for(const [e,f] of on.slice())if(e==='director_after_draw')f();};
 wr('A');wr('A');wr('B');draw();wr('C');draw();draw();
 const gaps=out.filter(l=>l.startsWith('[QF_B1_GAP] ')).map(l=>JSON.parse(l.slice(12)));assert.deepEqual(gaps.map(g=>[g.cut,g.from,g.to]),[[1,'A','B'],[2,'B','C']]);
 for(const g of gaps)assert.ok(Number.isFinite(g.firstDrawMs)&&g.firstDrawMs>=0&&Number.isFinite(g.pn));
 // her frame: occluder (cat box straddles the ray) → occ>0; bbox and safe area present
 const occBox=new cc.Node('wall');scene.addChild(occBox);mkR(occBox,[0,0.8,2.5,1,1,.1]);out.length=0;for(let k=0;k<31;k++)T.camLogFrame(cam);
 const hf=out.filter(l=>l.startsWith('[QF_HER_FRAME]'));assert.equal(hf.length,31,'one her-frame line per frame');const m=/bbox=([-\d.,]+) occ=([\d.]+) n=15 safe=0,34,390,776 pn=[\d.]+$/.exec(hf[hf.length-1]);
 assert.ok(m,'her-frame format: '+hf[hf.length-1]);assert.ok(+m[2]>0,'occluder not seen');
 for(const l of out.concat(gaps.map(()=>'')).filter(Boolean))assert.match(l,/pn=[\d.]+/,'probe line without pn: '+l);
 assert.equal(T.occludedFraction([0,0,0],[[0,0,10]],[[0,0,5,1,1,1]]),1);assert.equal(T.occludedFraction([0,0,0],[[0,0,10]],[[5,0,5,1,1,1]]),0);
 res.sample={gap:gaps[0],herFrame:hf[hf.length-1]};T.camLogReset();delete global.__QF_CAM_TRACE;}
console.log(JSON.stringify(res));console.log('probes: PASS');
