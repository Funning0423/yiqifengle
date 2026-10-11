'use strict';
/* T9 offline tests (QA only). Real IslandPropsLayout / IslandPropTaps (TypeScript, pinned tsc transpile) + the real
 * IslandJourneyOverlay + WarmButton through tools/cloud-ui/harness.cjs (memory-only Cocos doubles).
 * Engine rendering, GLB import and native touch are NOT covered (Mac build + T0 autoplay taps). */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {load,SRC}=require('./load_ts.cjs');
const M=load(['world-r1/CameraPose','world-r1/RegionCameraData','world-r2/IslandPropsLayout','world-r2/IslandPropTaps']);
const C=M.CameraPose,L=M.IslandPropsLayout,T=M.IslandPropTaps,P=L.ISLAND_PROPS;
const checks=[];const ok=(name,fn)=>{fn();checks.push(name);console.log('PASS',name);};
const pose=C.fromLookAt(M.RegionCameraData.islandPoseEntry());
const FRAMES=[[320,568],[375,667],[390,844],[402,874],[430,932],[568,320],[844,390]];
const inside=(r,w,h,inset=0)=>r.x-r.width/2>=-w/2+inset&&r.x+r.width/2<=w/2-inset&&r.y-r.height/2>=-h/2+inset&&r.y+r.height/2<=h/2-inset;
const overlap=(a,b)=>Math.abs(a.x-b.x)<(a.width+b.width)/2&&Math.abs(a.y-b.y)<(a.height+b.height)/2;

ok('layout: 3 slots per frame, inside the screen, hit covers prop + tag, no overlaps, tag above 30 px bottom inset (portrait)',()=>{
  for(const [w,h] of FRAMES){const lay=L.propButtonLayout(w,h);assert.equal(lay.slots.length,3);assert.deepEqual(lay.slots.map(s=>s.role),['bag','journal','settings']);
    for(const s of lay.slots){assert(inside(s.hit,w,h,2),`hit inside ${w}x${h} ${s.role}`);assert(inside(s.tag,w,h,2));
      assert(s.hit.y+s.hit.height/2>=s.prop.bottom+s.prop.height-1&&s.hit.y-s.hit.height/2<=s.tag.y-s.tag.height/2+1,'hit spans prop..tag');
      if(w<h)assert(s.tag.y-s.tag.height/2>=-h/2+30,'tag above bottom inset');assert(s.hit.width>=64&&s.hit.height>=64,'touch target >= 64');}
    for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert(!overlap(lay.slots[i].hit,lay.slots[j].hit),`hits overlap ${w}x${h}`);}
  const p=L.propButtonLayout(390,844).slots;assert.deepEqual(p.map(s=>Math.round(L.uiToScreen(s.prop.x,0,390,844)[0]*100)/100),[0.2,0.5,0.8],'mockup x = 0.2/0.5/0.8 W');
});
ok('screen props stand on the sea under their anchor at the runtime island camera (round trip within 0.5 px), scale sane',()=>{
  for(const [w,h] of FRAMES)for(const s of L.propButtonLayout(w,h).slots){const [sx,sy]=L.uiToScreen(s.prop.x,s.prop.bottom,w,h);
    const a=L.seaAnchor(pose,w/h,sx,sy,s.prop.height,h,P.buttons[s.role].heightM);assert(a.onSea,'on sea '+w+'x'+h);assert(Math.abs(a.point[1]-P.seaY)<1e-6);
    const q=C.projectPoint(pose,w/h,a.point);assert(Math.abs((q.x+1)/2*w-sx*w)<.5&&Math.abs((1-q.y)/2*h-sy*h)<.5,'round trip');
    const top=C.projectPoint(pose,w/h,[a.point[0],a.point[1]+P.buttons[s.role].heightM*a.scale,a.point[2]]);assert(Math.abs((top.y-q.y)/2*h-s.prop.height)<s.prop.height*.05,'pixel height');
    assert(a.scale>.3&&a.scale<6,'scale '+a.scale);}
});
ok('signpost: main-button size (>= 1.8x the 1653f02 scale 1.2, >= 40 % of the portrait width), hugs the front-right shore (posts in shallow water just below the waterline, panel overlaps sand <= 30 %), inside the 8 px safe inset, clear of bottom-row hits and the girl',()=>{
  const girl=C.characterBox([-2.1135,0,5.2814],1.7253,.3),S=P.signpost;
  assert(S.scale>=1.2*1.8,'scale '+S.scale+' vs 1653f02 1.2');
  for(const [w,h] of FRAMES){const r=L.signpostRectUi(pose,w,h);assert(r,'sign visible '+w+'x'+h);assert(inside(r,w,h,8),'sign inside safe inset '+w+'x'+h);
    for(const s of L.propButtonLayout(w,h).slots)assert(!overlap(r,s.hit),'sign vs '+s.role+' '+w+'x'+h);
    const g=L.projectRectUi(pose,w,h,girl);assert(!overlap(r,g),'sign covers girl '+w+'x'+h);}
  // hugs the shore: the posts stand in front of (below on screen) the waterline of the front-right beach and the base is at
  // most 0.9 sign-heights below it on screen (world: <= 2.2 sign-heights off the waterline, i.e. the shallow band, not open
  // sea); the panel may overlap the sand behind it by at most 30 % of its height (1653f02: 55 %, tightened since the sign
  // doubled: only the lamp hook may reach the sand line, the beach stays readable)
  const SHORE_Z=10.7; // measured: island ground crosses sea level (-0.92) at z ~ 10.6-10.7 for x = 1..3 (front-right beach)
  const hM=(S.boxMax[1]-S.boxMin[1])*S.scale;
  assert(S.position[2]>SHORE_Z+0.5&&S.position[2]<SHORE_Z+2.2*hM,'sign within the shallow band off the waterline: z='+S.position[2]);
  for(const [w,h] of FRAMES){const r=L.signpostRectUi(pose,w,h),shore=C.projectPoint(pose,w/h,[S.position[0],P.seaY,SHORE_Z]),shoreUi=shore.y*h/2;
    const bottom=r.y-r.height/2,top=r.y+r.height/2;assert(bottom<shoreUi,'posts below the waterline on screen '+w+'x'+h);
    assert((shoreUi-bottom)/r.height<=.9,'posts too far from the shore '+((shoreUi-bottom)/r.height).toFixed(2)+' '+w+'x'+h);
    assert((top-shoreUi)/r.height<=.30,'panel overlaps the beach by '+((top-shoreUi)/r.height).toFixed(2)+' '+w+'x'+h);}
  const r=L.signpostRectUi(pose,390,844);assert(.5+r.x/390>.55,'sign on the right half');assert(r.width/390>=.40,'portrait width fraction '+(r.width/390).toFixed(2));
  const base=C.projectPoint(pose,390/844,S.position);assert(base.depth>20);
});
ok('signpost mainline hit area: >= 88x88 logical px on every viewport, covers the whole sign, inside the 8 px inset, clear of bottom-row hits and the girl',()=>{
  const girl=C.characterBox([-2.1135,0,5.2814],1.7253,.3);assert.equal(L.SIGN_HIT_MIN,88);
  for(const [w,h] of FRAMES){const v=L.signpostRectUi(pose,w,h),r=L.signpostHitUi(pose,w,h);
    assert(r.width>=88&&r.height>=88,'hit '+r.width+'x'+r.height+' '+w+'x'+h);
    assert(r.x-r.width/2<=v.x-v.width/2+1e-6&&r.x+r.width/2>=v.x+v.width/2-1e-6&&r.y-r.height/2<=v.y-v.height/2+1e-6&&r.y+r.height/2>=v.y+v.height/2-1e-6,'hit covers sign '+w+'x'+h);
    assert(inside(r,w,h,8),'hit inside inset '+w+'x'+h);
    for(const s of L.propButtonLayout(w,h).slots)assert(!overlap(r,s.hit),'hit vs '+s.role+' '+w+'x'+h);
    assert(!overlap(r,L.projectRectUi(pose,w,h,girl)),'hit covers girl '+w+'x'+h);}
});
ok('sign water: shadow + 2 ripple rings, soft alpha, ripple period/phase; world props: palms on the beach band, sign base under sea level, Tangents=Exclude metas, all prefabs present',()=>{
  const W=P.signpost.water,sh=L.softEllipse(W.centerX,W.shadow.rx,W.shadow.rz),rg=L.softRing(W.centerX,W.ripple.rx,W.ripple.rz,W.ripple.band);
  for(const m of [sh,rg]){assert.equal(m.positions.length/3,m.colors.length/4);assert(m.indices.every(i=>i<m.positions.length/3));assert(m.positions.every((v,i)=>i%3!==1||v===0),'flat');}
  assert.equal(sh.colors[3],1);assert.equal(sh.colors[sh.colors.length-1],0,'shadow fades to 0 at the rim');assert(rg.colors.filter((_,i)=>i%4===3).every(a=>a===0||a===1));
  for(const x of W.postsX)assert(Math.abs(x-W.centerX)<W.ripple.rx*(1-W.ripple.band),'posts inside the ripple ring');
  const a0=L.rippleAt(0,0),a1=L.rippleAt(0,1),aw=L.rippleAt(W.ripple.periodS,0);assert.equal(a0.scale,1);assert(Math.abs(a1.scale-(1+W.ripple.grow/2))<1e-9);assert(Math.abs(aw.scale-a0.scale)<1e-9,'periodic');
  assert(L.rippleAt(W.ripple.periodS/2,0).alpha>.99&&a0.alpha<1e-9,'fade in/out');assert(W.ripple.nightAlpha<W.ripple.alpha&&W.shadow.nightAlpha<W.shadow.alpha,'dimmer at night');
  for(const p of P.palms){assert(p.position[2]>6.5&&p.position[2]<10.5,'palm z on beach');assert(p.position[1]>-1&&p.position[1]<.2);}
  assert(P.signpost.position[1]<P.seaY,'sign posts stand in the water');
  const dir=path.resolve(SRC,'../bundles/region_island',P.dir),names=[P.signpost.prefab,...P.palms.map(p=>p.prefab),...Object.values(P.buttons).map(b=>b.prefab)];
  for(const n of names){const m=JSON.parse(fs.readFileSync(path.join(dir,n+'.glb.meta'),'utf8'));assert.equal(m.importer,'gltf');assert.equal(m.userData.tangents,1,'Tangents=Exclude '+n);
    const b=fs.readFileSync(path.join(dir,n+'.glb')),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert(!j.images,'no embedded images '+n);
    const mats=j.materials.map(x=>x.name);assert(mats.every(x=>x==='M_env_palette'||(n==='ui_signpost'&&x==='M_signpost_lamp')),'materials '+n+' '+mats);
    assert((j.extensionsUsed||[]).includes('KHR_draco_mesh_compression'));}
  assert(!fs.existsSync(path.join(dir,'beach_gull.glb'))&&!fs.existsSync(path.join(dir,'beach_crab.glb'))&&!fs.existsSync(path.join(dir,'beach_turtle.glb')),'duplicate animals not added');
  assert.equal(fs.readdirSync(dir).filter(f=>f.endsWith('.glb')).length,6);
});
ok('IslandPropTaps: subscribe/unsubscribe, info flags, listener errors isolated',()=>{
  const got=[];const off=T.onPropTap((t,ph,i)=>got.push([t,ph,i.blocked,i.props]));const bad=T.onPropTap(()=>{throw Error('x');});
  const warn=console.warn;console.warn=()=>{};T.setPropTapLook(true);T.emitPropTap('bag','press',false);T.emitPropTap('signpost','confirm',true);console.warn=warn;
  assert.deepEqual(got,[['bag','press',false,true],['signpost','confirm',true,true]]);off();off();bad();T.emitPropTap('bag','press',false);assert.equal(got.length,2);assert.equal(T.propTapListenerCount(),0);
  assert.equal(typeof T.onPropTap(null),'function');T.setPropTapLook(false);
});
// ---- real overlay through the cloud-ui harness
const H=require('../cloud-ui/harness.cjs')(),{Node,UITransform,Label,warm}=H;
const skin=H.evaluate(path.join(H.root,'ui/JourneyNavigationSkin.ts'),['applyJourneyNavigationSkin'],{warmButtonGraphics:warm.warmButtonGraphics});
const camPose=H.evaluate(path.join(H.root,'world-r1/CameraPose.ts'),['projectPoint','rotate']);
const propLayout=H.evaluate(path.join(H.root,'world-r2/IslandPropsLayout.ts'),['ISLAND_PROPS','propButtonLayout'],camPose);
const taps=H.evaluate(path.join(H.root,'world-r2/IslandPropTaps.ts'),['emitPropTap','onPropTap','setPropTapLook']);
class UIOpacity{constructor(){this.opacity=255;}}
const {IslandJourneyOverlay:Overlay}=H.evaluate(path.join(H.root,'world-r2/IslandJourneyOverlay.ts'),['IslandJourneyOverlay'],{warmButton:warm.warmButton,...skin,...propLayout,emitPropTap:taps.emitPropTap,UIOpacity});
function setup(w=390,h=844){H.setup('mainline-v33',0,w,h);const calls=[],o=new Overlay(new Node('Canvas'),{invoke:fn=>{calls.push('invoke');return fn();},mainlineStatus:()=>({}),gates:()=>({r5:[],r4:[]}),enterRegion:()=>{},enterR4:()=>{},enterSkycity:()=>{},returnHome:()=>{},toggleDayNight:()=>calls.push('dayNight'),dayNight:()=>({mode:'day'})});o.sync(w,h,true);return {o,calls};}
ok('overlay prop mode: same three WarmButton nodes become invisible hit areas at the prop slots, cream tags with labels; off restores',()=>{
  for(const [w,h] of FRAMES){const {o}=setup(w,h);assert(o.dockVisible());o.setPropMode(true);const lay=L.propButtonLayout(w,h);
    o.buttons.forEach((n,i)=>{const t=n.getComponent(UITransform),s=lay.slots[i];assert.equal(n.getComponent(UIOpacity).opacity,0);assert.equal(t.width,s.hit.width);assert.equal(t.height,s.hit.height);assert.equal(n.position.x,s.hit.x);assert.equal(n.position.y,s.hit.y);});
    assert.deepEqual(o.dock.children.map(n=>n.name),['Island-bag','Island-journal','Island-settings','IslandPropTag-bag','IslandPropTag-journal','IslandPropTag-settings']);
    assert.deepEqual(o.tags.map(t=>t.getComponentInChildren(Label).string),['行囊','旅程册','设置']);assert.deepEqual(o.tags.map(t=>t.getComponentInChildren(Label).color.toHEX?.()??'x').length,3);
    o.setPropMode(false);o.buttons.forEach(n=>{assert.equal(n.getComponent(UIOpacity).opacity,255);assert.equal(n.getComponent(UITransform).width,64);});assert(o.tags.every(t=>!t.active));o.dispose();}
});
ok('overlay taps: press+confirm per target (journal -> book), same action; blocked confirm runs nothing; dock hidden while open',()=>{
  const {o,calls}=setup();o.setPropMode(true);const got=[];const off=taps.onPropTap((t,ph,i)=>got.push(t+':'+ph+(i.blocked?':blocked':'')));
  H.tapNode(o.buttons[0]);assert.equal(o.page,'bag');assert(!o.dockVisible());o.close();
  H.tapNode(o.buttons[1]);assert.equal(o.page,'journal');o.close();H.tapNode(o.buttons[2]);assert.equal(o.page,'settings');
  const n=o.buttons[0];o.page='settings';H.tapNode(n);assert.equal(o.page,'settings','tap on hidden dock leaves the open page');o.close();
  // blocked confirm: finger down on bag, a page opens before the finger lifts -> confirm(blocked), no action
  const e=H.event(H.point(n),5);n.emit('start',e);o.page='journal';n.emit('end',e);assert.equal(o.page,'journal');o.close();
  o.sync(390,844,false);const before=got.length;H.tapNode(o.buttons[2]);const late=got.slice(before);
  assert.deepEqual(got.slice(0,9),['bag:press','bag:confirm','book:press','book:confirm','settings:press','settings:confirm','bag:press:blocked','bag:press','bag:confirm:blocked']);
  assert(late.every(x=>x.endsWith(':blocked')),'disabled overlay: only blocked events '+late);assert.equal(calls.length,0,'opening pages never invokes a command');off();o.dispose();
});
ok('WorldIntegrationBoot wiring (source): mainline emits signpost press/confirm from its bound action; props optional; overlay prop mode only after load ok',()=>{
  const s=fs.readFileSync(path.join(SRC,'WorldIntegrationBoot.ts'),'utf8');
  assert(/if\(id==='mainline'\)n\.on\(Node\.EventType\.TOUCH_START,\(\)=>emitPropTap\('signpost','press',blocked\(\)\)\)/.test(s));
  assert(/surface\.bind\(\(\)=>\{if\(id==='mainline'\)emitPropTap\('signpost','confirm',blocked\(\)\);if\(blocked\(\)\)return false;/.test(s));
  assert(s.includes("this.button('mainline','继续旅程  →',()=>this.composition.enterMainline());"),'mainline handler unchanged');
  assert(/try\{const props=new IslandProps\(scene,camera\);this\.islandProps=props;void props\.load\(\)\.then\(ok=>\{if\(this\.islandProps!==props\|\|!ok\)return;this\.islandJourney\?\.setPropMode\(true\);\}\);\}catch/.test(s));
  assert(s.includes('onPropTap,'),'__worldIntegration.onPropTap for T0');
  assert(!/playSfx|AudioSource|GameAudio\.instance/.test(fs.readFileSync(path.join(SRC,'world-r2/IslandProps.ts'),'utf8')+fs.readFileSync(path.join(SRC,'world-r2/IslandPropTaps.ts'),'utf8')),'no sound played by T9');
});
console.log('ALL PASS',checks.length,'checks (tsc '+M.tsVersion+')');
