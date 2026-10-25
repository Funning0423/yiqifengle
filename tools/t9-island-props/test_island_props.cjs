'use strict';
/* T9 offline tests (QA only). Real IslandPropsLayout / IslandPropTaps (TypeScript, pinned tsc transpile) + the real
 * IslandJourneyOverlay + WarmButton through tools/cloud-ui/harness.cjs (memory-only Cocos doubles).
 * Engine rendering, GLB import and native touch are NOT covered (Mac build + T0 autoplay taps). */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {load,SRC,typescript}=require('./load_ts.cjs');
const M=load(['world-r1/CameraPose','world-r1/RegionCameraData','world-r2/IslandPropsLayout','world-r2/IslandPropTaps']);
const C=M.CameraPose,L=M.IslandPropsLayout,T=M.IslandPropTaps,P=L.ISLAND_PROPS;
let BootSign=null;const checks=[];const ok=(name,fn)=>{fn();checks.push(name);console.log('PASS',name);};
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
  for(const [w,h] of FRAMES){const v=L.signpostRectUi(pose,w,h,L.signpostShiftX(pose,w,h)),r=L.signpostHitUi(pose,w,h); // b16 ④: the sign is shifted left on wide phones
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
const camPose=H.evaluate(path.join(H.root,'world-r1/CameraPose.ts'),['projectPoint','rotate']);
const propLayout=H.evaluate(path.join(H.root,'world-r2/IslandPropsLayout.ts'),['ISLAND_PROPS','propButtonLayout','propNightWeight','tagColorsAt','setPropNightWeight'],camPose);
const taps=H.evaluate(path.join(H.root,'world-r2/IslandPropTaps.ts'),['emitPropTap','onPropTap','setPropTapLook']);
const {UIOpacity}=H.cc;
const {IslandJourneyOverlay:Overlay}=H.evaluate(path.join(H.root,'world-r2/IslandJourneyOverlay.ts'),['IslandJourneyOverlay']);
function setup(w=390,h=844){H.H.setViewport(w,h);const calls=[],o=new Overlay(new Node('Canvas'),{invoke:fn=>{calls.push('invoke');return fn();},mainlineStatus:()=>({}),gates:()=>({r5:[],r4:[]}),enterRegion:()=>{},enterR4:()=>{},enterSkycity:()=>{},returnHome:()=>{},toggleDayNight:()=>calls.push('dayNight'),dayNight:()=>({mode:'day'})});o.sync(w,h,true);return {o,calls};}
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
  const e=H.event(H.point(n),5);n.emit(Node.EventType.TOUCH_START,e);o.page='journal';n.emit(Node.EventType.TOUCH_END,e);assert.equal(o.page,'journal');o.close();
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
ok('signpost entrance (REAL Boot applyIslandEntrance/gateSignEntrance/trackTransitionHud, transpiled): buttons first (0.25 s, cubic ease-out, 24 px), mainline hit area never moved/scaled, then the signpost rises 24 px + fades in with the same duration/easing; hit area live only after; level round trip -> stays shown (no entrance, no flicker)',()=>{
  const src=fs.readFileSync(path.join(SRC,'WorldIntegrationBoot.ts'),'utf8');
  const grab=name=>{const i=src.indexOf(' private '+name+'(');assert(i>0,name);const j=src.indexOf('\n }\n',i);return src.slice(i,j+3).replace(' private ',' ');};
  const away=src.match(/\nconst SIGN_AWAY_STATES=(\[[^\]]*\]);/);assert(away,'SIGN_AWAY_STATES');
  const fields=src.match(/\n private signShown=1;private signOut=-1;private signPrev='';\n/);assert(fields,'sign fields');
  const cls='const SIGN_AWAY_STATES='+away[1]+';\nclass B{'+fields[0].replace(/private /g,'')+['trackTransitionHud','applyIslandEntrance','setSign','gateSignEntrance'].map(grab).join('\n')+'}\nmodule.exports=B;';
  const js=typescript().transpileModule(cls,{compilerOptions:{target:99,module:1}}).outputText;const mod={exports:{}};new Function('module','exports',js)(mod,mod.exports);const B=mod.exports;BootSign=B;
  // the same constants as the T2 button entrance
  assert(/Math\.max\(0,Math\.min\(dt,\.1\)\)\/\.25/.test(src)&&/1-Math\.pow\(1-this\.signEntrance,3\)/.test(src)&&/this\.setSign\(e,24\*\(1-e\)\)/.test(src),'same duration/easing/slide');
  const calls=[],moved=[],dockLog=[];
  const node=(name,log)=>({active:true,position:{x:0,y:0,z:0},setPosition(x,y,z){this.position={x,y,z};log&&log.push(['p',y]);},setScale(k){log&&log.push(['s',k]);}});
  const dock=node('dock',dockLog),mainline=node('mainline',moved);
  const b=Object.assign(new B(),{hudState:'',islandEntrance:-1,signEntrance:-1,propSign:true,islandProps:{ready:true,setSignEntrance:(e,r)=>calls.push([+e.toFixed(4),+(r||0).toFixed(3)])},
    canvas:{getChildByName:()=>({getChildByName:()=>dock})}});
  const frame=(state,dt)=>{b.trackTransitionHud(state);if(state==='island')b.applyIslandEntrance(dt,mainline);b.gateSignEntrance(state,dt);};
  frame('crossing-out',1/60);assert.deepEqual(calls.pop(),[0,0],'hidden while flying out');
  let t=0,firstSign=null,signDone=null;const live=[];
  for(let i=0;i<60;i++){const before=calls.length;frame('island',1/60);t+=1/60;const hitLive=!(b.islandEntrance>=0||b.signEntrance>=0);live.push(hitLive);
    const c=calls.slice(before);if(firstSign===null&&c.some(x=>x[0]>0))firstSign=t;if(signDone===null&&c.some(x=>x[0]===1))signDone=t;}
  assert.equal(moved.length,0,'transparent mainline hit area not moved/scaled by the entrance');
  assert(dockLog.length>0&&dockLog.some(x=>x[0]==='p'&&x[1]<0),'buttons slide');
  assert(firstSign>0.25-1e-6&&firstSign<=0.25+3/60,'sign starts after the buttons: '+firstSign);
  assert(Math.abs(signDone-0.5)<=3/60,'sign done at ~0.5 s: '+signDone);
  const anim=calls.filter(x=>x[0]>0&&x[0]<1);assert(anim.length>=10,'animated frames');
  for(let i=1;i<anim.length;i++)assert(anim[i][0]>anim[i-1][0]&&anim[i][1]<anim[i-1][1],'alpha up, rise down');
  assert(Math.abs(anim[0][1]-24*(1-anim[0][0]))<5e-3,'rise = 24 px * (1-e)');
  const firstLive=live.indexOf(true);assert(firstLive>=0&&live.slice(firstLive).every(Boolean)&&Math.abs((firstLive+1)/60-signDone)<=2/60,'hit area live once the sign entrance ends');
  // arrival without entrance (e.g. back from a level) -> shown at once, hit area live
  calls.length=0;for(const st of ['level-loading','level','island','skycity-loading','skycity','island','paused','island'])for(let i=0;i<10;i++)frame(st,1/60);
  assert(calls.every(c=>c[0]===1),'level/skycity/paused round trip: sign untouched or shown');assert(!(b.islandEntrance>=0||b.signEntrance>=0));
  // flat-button fallback (no props): mainline gets the T2 entrance as before
  const b2=Object.assign(new B(),{hudState:'crossing-out',islandEntrance:-1,signEntrance:-1,propSign:false,islandProps:null,canvas:b.canvas});moved.length=0;b2.trackTransitionHud('island');b2.applyIslandEntrance(1/60,mainline);assert(moved.length===2,'flat mainline still animated');
  assert(/if\(sign&&\(this\.islandEntrance>=0\|\|this\.signEntrance>=0\)\)sign=\{x:sign\.x,y:sign\.y,width:0,height:0\};/.test(src),'zero-size hit area during the entrance');
});
ok('R3 (Mac r3: board floating near the shore on the walk home, mirrored text): REAL Boot gate - the sign fades OUT (mirror of the entrance: 0.25 s, cubic, sinking 24 px) when the return walk starts, stays 0 on the whole return (walking-home incl. crane, crossing-in, door, seat, home) and the next leave (crossing-out), then buttons + entrance on arrival; a cancelled return fades back IN from where it was (no pop)',()=>{
  const B=BootSign;assert(B,'previous check loaded the Boot gate');const calls=[];
  const dock={position:{x:0,y:0,z:0},setPosition(){},setScale(){}};
  const b=Object.assign(new B(),{hudState:'island',islandEntrance:-1,signEntrance:-1,propSign:true,signPrev:'island',islandProps:{ready:true,setSignEntrance:(e,r)=>calls.push([+e.toFixed(4),+(r||0).toFixed(3)])},canvas:{getChildByName:()=>({getChildByName:()=>dock})}});
  const frame=(state,dt=1/60)=>{const n=calls.length;b.trackTransitionHud(state);if(state==='island')b.applyIslandEntrance(dt,null);b.gateSignEntrance(state,dt);return calls.slice(n);};
  for(let i=0;i<5;i++)frame('island');assert.equal(b.signShown,1);
  // return walk: fade out
  const out=[];let t=0,zeroAt=null;for(let i=0;i<40;i++){const c=frame('walking-home');t+=1/60;out.push(...c);if(zeroAt===null&&c.some(x=>x[0]===0))zeroAt=t;}
  assert(Math.abs(zeroAt-.25)<=2/60,'faded out at ~0.25 s: '+zeroAt);
  const mid=out.filter(x=>x[0]>0&&x[0]<1);assert(mid.length>=10,'animated fade-out frames');for(let i=1;i<mid.length;i++)assert(mid[i][0]<mid[i-1][0]&&mid[i][1]>mid[i-1][1],'alpha down, sinks');
  assert(Math.abs(mid[0][1]-24*(1-mid[0][0]))<5e-3,'sink = 24 px * (1-e)');
  for(const st of ['walking-home','crossing-in','closing-door','walking-to-seat','sitting','home','standing','turning-out','walking-out','opening-door','crossing-out']){const c=[];for(let i=0;i<20;i++)c.push(...frame(st));assert(c.every(x=>x[0]===0),'hidden in '+st);assert.equal(b.signShown,0);}
  // arrival: buttons first, sign stays 0, then the entrance to 1
  const arr=[];for(let i=0;i<60;i++)arr.push(...frame('island'));const first=arr.findIndex(x=>x[0]>0);assert(first>=14,'sign waits for the buttons: '+first);
  for(let i=first+1;i<arr.length;i++)assert(arr[i][0]>=arr[i-1][0],'entrance monotonic');assert.equal(arr[arr.length-1][0],1);assert.equal(b.signShown,1);
  // cancelled return (walking-home -> island after 5 frames): fade back in from the current value, no pop to 0 or 1
  for(let i=0;i<5;i++)frame('walking-home');const e0=b.signShown;assert(e0>0&&e0<1,'mid fade '+e0);
  const back=[];for(let i=0;i<30;i++)back.push(...frame('island'));assert(back.length>0&&back[0][0]>=e0-1e-3&&back[0][0]<1,'resumes from '+e0+' not '+back[0][0]);
  for(let i=1;i<back.length;i++)assert(back[i][0]>=back[i-1][0]);assert.equal(back[back.length-1][0],1);
  // cold start at home (sign never on screen): snaps to 0, no fade
  const c2=[];const b2=Object.assign(new B(),{hudState:'',islandEntrance:-1,signEntrance:-1,propSign:false,islandProps:{ready:true,setSignEntrance:e=>c2.push(e)},canvas:b.canvas});
  b2.trackTransitionHud('home');b2.gateSignEntrance('home',1/60);assert.deepEqual(c2,[0]);
});
ok('R3: IslandProps.setSignEntrance(0) hides the whole sign set (sign node, water shadow + ripple NODES, lamp SphereLight, both additive glows); tickWater keeps the lamp light off at entrance 0; night sea tint is not tied to the sign',()=>{
  const src=fs.readFileSync(path.join(SRC,'world-r2/IslandProps.ts'),'utf8');
  assert(/this\.waterNodes\.push\(n\); n\.active = this\.entrance > 0;/.test(src),'water nodes registered');
  assert(/for \(const n of this\.waterNodes\) if \(isValid\(n, true\) && n\.active !== e > 0\) n\.active = e > 0;/.test(src),'water nodes follow the sign');
  assert(/if \(e <= 0\) \{ if \(this\.lampLight && isValid\(this\.lampLight, true\) && this\.lampLight\.enabled\) \{ this\.lampLight\.luminance = 0; this\.lampLight\.enabled = false; \}/.test(src),'lamp light off at 0');
  assert(/for \(const g of \[this\.glow, this\.lampGlow\]\) if \(g && isValid\(g\.node, true\) && g\.node\.active\) g\.node\.active = false;/.test(src),'glows off at 0');
  assert(/const on = L\.enabled && this\.entrance > 0; if \(this\.lampLight\.enabled !== on\) this\.lampLight\.enabled = on;/.test(src),'tickWater keeps it off');
  assert(/this\.tickSea\(this\.nightW\);/.test(src)&&!/tickSea\([^)]*entrance/.test(src),'sea tint independent of the sign and of the exterior layer');
  assert(/if \(this\.root\.active !== o\.exterior\) this\.root\.active = o\.exterior;/.test(src),'whole prop root off when the exterior is not visible (nothing in the room)');
});
ok('night sign text: day ink stays #633f21; night ink stays #3a220f',()=>{
  const S=P.signpost.text;
  assert.equal(S.color,'#633f21','day sign unchanged');
  assert.equal(S.nightColor,'#3a220f');
});
ok('T9n night tags: day = T9 cream colours, night = warm grey card + deeper brown text; contrast >= 4.5:1 at every step of the blend; night card about as dark as the 0.35 night light',()=>{
  const T=P.tag,d=L.tagColorsAt(0),n=L.tagColorsAt(1);
  assert.deepEqual([d.fill,d.edge,d.text],[T.fill,T.edge,T.text]);assert.deepEqual([n.fill,n.edge,n.text],[T.nightFill,T.nightEdge,T.nightText]);
  let min=99;for(let i=0;i<=100;i++){const c=L.tagColorsAt(i/100),r=L.contrastRatio(c.text,c.fill);min=Math.min(min,r);}
  assert(L.contrastRatio(d.text,d.fill)>=4.5&&L.contrastRatio(n.text,n.fill)>=4.5&&min>=4.5,'contrast day '+L.contrastRatio(d.text,d.fill).toFixed(2)+' night '+L.contrastRatio(n.text,n.fill).toFixed(2)+' min '+min.toFixed(2));
  const lum=h=>(L.contrastRatio(h,'#000000')*0.05)-0.05;const k=lum(n.fill)/lum(d.fill);assert(k>0.2&&k<0.5,'night card luminance ratio '+k.toFixed(2));
  assert.equal(L.mixHex('#000000','#ffffff',0.5),'#808080');
});
ok('T9n night weight: switch fades over nightFadeS (0.5 s), monotone, both ways; lamp light off at day, smoothstep in (0 slope at both ends), full = luminanceScale',()=>{
  let w=0,steps=0;const seq=[];while(w<1&&steps<200){w=L.approachNight(w,true,1/60);seq.push(w);steps++;}
  assert(Math.abs(steps/60-P.nightFadeS)<=2/60,'fade '+steps/60);for(let i=1;i<seq.length;i++)assert(seq[i]>seq[i-1]);
  let b=1,back=0;while(b>0&&back<200){b=L.approachNight(b,false,1/60);back++;}assert.equal(back,steps);
  assert.equal(L.approachNight(0.3,true,5),0.3+0.1/P.nightFadeS,'dt clamped to 0.1 s');
  const off=L.lampLightAt(0),on=L.lampLightAt(1);assert(!off.enabled&&off.scale===0);assert(on.enabled&&on.scale===P.signpost.lampLight.luminanceScale);
  const e=1e-3;assert(L.lampLightAt(e).scale<on.scale*1e-5&&on.scale-L.lampLightAt(1-e).scale<on.scale*1e-5,'eases at both ends (no pop)');
  for(let i=1;i<=100;i++)assert(L.lampLightAt(i/100).scale>=L.lampLightAt((i-1)/100).scale);
  L.setPropNightWeight(2);assert.equal(L.propNightWeight(),1);L.setPropNightWeight(NaN);assert.equal(L.propNightWeight(),0);
});
ok('T9n overlay tags follow the props night weight (real overlay): day colours, repaint to night colours after setPropNightWeight(1)+sync, intermediate weight mixes, back to day',()=>{
  const {o}=setup();o.setPropMode(true);const col=()=>o.tags.map(t=>{const c=t.getComponentInChildren(Label).color;return String(c.hex??(c.toHEX?c.toHEX('#rrggbb'):c)).replace('#','').slice(0,6).toLowerCase();});
  const hex=h=>h.replace('#','').slice(0,6).toLowerCase();
  propLayout.setPropNightWeight(0);o.sync(390,844,true);assert.deepEqual(col(),Array(3).fill(hex(P.tag.text)));
  propLayout.setPropNightWeight(1);o.sync(390,844,true);assert.deepEqual(col(),Array(3).fill(hex(P.tag.nightText)));
  propLayout.setPropNightWeight(.5);o.sync(390,844,true);assert.deepEqual(col(),Array(3).fill(hex(L.tagColorsAt(.5).text)));
  propLayout.setPropNightWeight(.505);o.sync(390,844,true);assert.deepEqual(col(),Array(3).fill(hex(L.tagColorsAt(.5).text)),'sub-2% step: no repaint');
  propLayout.setPropNightWeight(0);o.sync(390,844,true);assert.deepEqual(col(),Array(3).fill(hex(P.tag.text)));o.dispose();
});
ok('T9n lamp light wiring (source): night-only SphereLight on the sign layer only (Light.visibility), camera-layer guard, follows lampLightAt(night weight); warm additive water pool; sign text colour by weight; lamp glass swap at mid-fade; no global material / RoomLightingRig / Boot change',()=>{
  const src=fs.readFileSync(path.join(SRC,'world-r2/IslandProps.ts'),'utf8');
  assert(/addComponent\(SphereLight\)/.test(src)&&/l\.visibility = layer/.test(src)&&/\(this\.camera\.visibility & layer\) === 0/.test(src));
  assert(/const L = lampLightAt\(w\)/.test(src)&&/this\.lampLight\.luminance = this\.lampBase \* L\.scale \* this\.entrance/.test(src));
  assert(/findIndex\(t => t\.name === 'add'\)/.test(src)&&/SignLampReflection/.test(src));
  assert(/mixHex\(S\.text\.color, S\.text\.nightColor, w\)/.test(src)&&/const lampNight = this\.nightW >= 0\.5/.test(src));
  assert(!/import[^\n]*RoomLightingRig|setRoomLightWeight|mainLight|\.sharedMaterial\.setProperty|palette!?\.setProperty/.test(src),'no global light/material writes');
  const lay=P.signpost.lampLight;assert(lay.layerBit>=0&&lay.layerBit<20,'user layer');assert(((1820327937>>>lay.layerBit)&1)===1,'world camera (scene _visibility 1820327937) renders the sign layer');
});
ok('T9n-2 lamp + sea: amber unlit lamp glass (not white), soft glow, board light gentle (scale <= 0.6, range <= 2 sign-m), subtle warm water; night sea tint: exact authored colour at w=0, authored x tint at w=1, only the renderer instance (never shared M_env_sea), restored on dispose',()=>{
  const S=P.signpost,G=S.lampGlass,ch=L.mixHex(G.nightColor,G.nightColor,0).slice(1).match(/../g).map(h=>parseInt(h,16));
  assert(Math.min(...ch)<0.45*Math.max(...ch)&&ch[0]===255,'amber, not white: '+G.nightColor);
  assert(L.contrastRatio(G.nightColor,'#000000')>L.contrastRatio(S.lampLight.color,'#000000')*0.9,'glass at least as bright as the light colour');
  assert(S.lampLight.luminanceScale<=0.6&&S.lampLight.range<=2,'gentle board light');assert(S.lampLight.reflection.alpha<=0.15&&G.glow.alpha<=0.5);
  const lin=L.srgbToLinear(P.seaNight.tint);assert.deepEqual(lin.map(v=>+v.toFixed(3)),[0.212,0.347,0.451]);
  assert.deepEqual(L.seaColorAt([255,255,255,255],0),[255,255,255,255]);assert.deepEqual(L.seaColorAt([255,255,255,255],1),[127,159,179,255]);
  assert.deepEqual(L.seaColorAt([200,220,240,255],0.5),[150,179,204,255]);
  // v3.1 journey night sea: day untouched whatever the journey weight; j=0 is the old night; j=1 deepens to journeyTint
  assert.equal(P.seaNight.tint,'#7f9fb3');assert.equal(P.seaNight.journeyTint,'#4a6a8c');
  for(const c of [[255,255,255,255],[200,220,240,255],[90,180,210,200]])for(const j of [0,.3,1])assert.deepEqual(L.seaColorAt(c,0,j),c,'day sea must stay authored');
  assert.deepEqual(L.seaColorAt([200,220,240,255],0.5,0),L.seaColorAt([200,220,240,255],0.5));
  assert.deepEqual(L.seaColorAt([255,255,255,255],1,1),[74,106,140,255]);
  {const lum=v=>.2126*v[0]+.7152*v[1]+.0722*v[2],base=[120,200,220,255];let prev=1e9;for(const j of [0,.25,.5,.75,1]){const l=lum(L.seaColorAt(base,1,j));assert(l<prev,'journey tint monotonic darker');prev=l;}}
  {const boot=fs.readFileSync(path.join(SRC,'WorldIntegrationBoot.ts'),'utf8'),src2=fs.readFileSync(path.join(SRC,'world-r2/IslandProps.ts'),'utf8');
   assert(/night:dn\?\.mode==='night',journey:s\.state==='region-travel'/.test(boot),'boot passes journey from region-travel');
   assert(/journey\?: boolean/.test(src2)&&/approachNight\(this\.journeyW, !!o\.journey, dt\)/.test(src2)&&/t\.tick\(w, this\.journeyW, dt\)/.test(src2),'IslandProps fades journey weight into the sea tint');}
  const src=fs.readFileSync(path.join(SRC,'world-r2/IslandProps.ts'),'utf8');
  {const st=fs.readFileSync(path.join(SRC,'world-r2/SeaNightTint.ts'),'utf8');assert(/never adopt the shared asset/.test(st)&&/m === shared\) \{ this\.state = 'failed'/.test(st),'never the shared sea material');}
  assert(!/setSharedMaterial\([^)]*sea/i.test(src)&&/restoreSea\(\)/.test(src)&&/this\.tickSea\(this\.nightW\)/.test(src));
  assert(/effectName: 'builtin-unlit', technique: 0 \}\); m\.setProperty\('mainColor', new Color\(S\.lampGlass\.nightColor\)\)/.test(src)&&/SignLampGlow/.test(src));
  assert(!/moon/i.test(src),'no moon (owned by 场景特效bot)');
});
ok('pull keeps bag/journal/settings at the settled wide-shot screen size; labels stay on those slots; the sea sign still grows',()=>{
  const ref=C.fromLookAt(M.RegionCameraData.islandPoseEntry());
  const {load:loadRail}=require('../camera-frame-test/load_ts.cjs');
  const Rail=loadRail();
  const cfg=Rail.FirstsliceRoutes.createFirstsliceRoutes(Rail.FirstsliceFacts.FIRSTSLICE,Rail.CharacterReference.CHARACTER_REFERENCE);
  const rail=Rail.IslandRail.createIslandRail(cfg);
  const verts=(a,model)=>{const hx=model.widthM/2,hz=model.depthM/2,hy=model.heightM,out=[];
    for(const x of [-hx,hx])for(const y of [0,hy])for(const z of [-hz,hz]){
      const v1=C.rotate(a.localRotation,[x,y,z]);
      const v3=C.rotate(a.pivotRotation,[v1[0]*a.pivotScale[0],v1[1]*a.pivotScale[1],v1[2]*a.pivotScale[2]]);
      out.push([a.point[0]+v3[0],a.point[1]+v3[1],a.point[2]+v3[2]]);}
    return out;};
  const px=(pose,aspect,w,h,p)=>{const q=C.projectPoint(pose,aspect,p);return [(q.x+1)/2*w,(1-q.y)/2*h];};
  for(const [w,h] of [[402,874],[844,390]]){
    const aspect=w/h,lay=L.propButtonLayout(w,h);
    rail.restore(1);const far=rail.pose();
    const settled={};
    for(const s of lay.slots){
      const model=P.buttons[s.role],[sx,sy]=L.uiToScreen(s.prop.x,s.prop.bottom,w,h);
      const a=L.screenPropPose(far,ref,aspect,sx,sy,s.prop.height,h,model);
      assert(a.onSea,'wide shot on the sea '+s.role);
      const origin=px(far,aspect,w,h,a.point);
      assert(Math.hypot(origin[0]-sx*w,origin[1]-sy*h)<0.5,'anchor stays on the slot '+s.role);
      const got=verts(a,model),minY=Math.min(...got.map(v=>v[1]));
      assert(minY>=P.seaY+0.015-1e-3,'above the sea '+s.role+' '+minY);
      const sea=L.seaAnchor(far,aspect,sx,sy,s.prop.height,h,model.heightM);
      const yaw=sea.yawDeg*Math.PI/180,hh=yaw/2,q=[0,Math.sin(hh),0,Math.cos(hh)];
      const box=[[-model.widthM/2,0,-model.depthM/2],[model.widthM/2,model.heightM,model.depthM/2]];
      let worst=0;const seaVerts=[];
      for(const x of [box[0][0],box[1][0]])for(const y of [box[0][1],box[1][1]])for(const z of [box[0][2],box[1][2]]){
        const l=C.rotate(q,[x*sea.scale,y*sea.scale,z*sea.scale]);seaVerts.push([sea.point[0]+l[0],sea.point[1]+l[1],sea.point[2]+l[2]]);
      }
      for(let i=0;i<8;i++){const A=px(far,aspect,w,h,got[i]),B=px(far,aspect,w,h,seaVerts[i]);worst=Math.max(worst,Math.hypot(A[0]-B[0],A[1]-B[1]));}
      assert(worst<0.5,'wide shot matches the old upright prop '+worst.toFixed(3)+' '+s.role);
      settled[s.role]=got.map(p=>px(far,aspect,w,h,p));
    }
    for(const u of [0.5,0]){
      rail.restore(u);const pose=rail.pose();
      for(const s of lay.slots){
        const model=P.buttons[s.role],[sx,sy]=L.uiToScreen(s.prop.x,s.prop.bottom,w,h);
        const old=L.seaAnchor(pose,aspect,sx,sy,s.prop.height,h,model.heightM);
        const yaw=old.yawDeg*Math.PI/180,hh=yaw/2,q=[0,Math.sin(hh),0,Math.cos(hh)];
        const left=C.projectPoint(pose,aspect,[old.point[0]-Math.cos(yaw)*model.widthM*old.scale/2,old.point[1],old.point[2]+Math.sin(yaw)*model.widthM*old.scale/2]);
        const right=C.projectPoint(pose,aspect,[old.point[0]+Math.cos(yaw)*model.widthM*old.scale/2,old.point[1],old.point[2]-Math.sin(yaw)*model.widthM*old.scale/2]);
        const oldW=Math.abs(right.x-left.x)/2*w;
        const a=L.screenPropPose(pose,ref,aspect,sx,sy,s.prop.height,h,model);
        const got=verts(a,model);
        assert(Math.min(...got.map(v=>v[1]))>=P.seaY+0.015-1e-3,'pull stays above the sea '+s.role+' u='+u);
        let worst=0;const base=settled[s.role];
        for(let i=0;i<8;i++){const A=px(pose,aspect,w,h,got[i]);worst=Math.max(worst,Math.hypot(A[0]-base[i][0],A[1]-base[i][1]));}
        assert(worst<0.5,'screen size held u='+u+' '+s.role+' drift '+worst.toFixed(3)+'px (old width '+oldW.toFixed(0)+')');
        if(u===0&&s.role==='bag'&&w<h)assert(oldW>120,'the unfixed prop really does balloon, width '+oldW.toFixed(0));
      }
    }
    const farSign=L.signpostRectUi(far,w,h);rail.restore(0);const nearSign=L.signpostRectUi(rail.pose(),w,h);
    assert(farSign&&nearSign&&nearSign.width*nearSign.height>farSign.width*farSign.height*1.4,'sign stays in the world and grows when the lens comes in');
    assert.deepEqual(P.signpost.position,[-1.2,-1.15,18.8]);
  }
  const overlay=fs.readFileSync(path.join(SRC,'world-r2/IslandJourneyOverlay.ts'),'utf8');
  const propsSrc=fs.readFileSync(path.join(SRC,'world-r2/IslandProps.ts'),'utf8');
  assert(overlay.includes('ISLAND_PROPS.buttons[role].label')&&/l\.fontSize=s\.tag\.fontSize/.test(overlay),'tags use the screen slot, not the lens');
  assert(!/screenPropPose|seaAnchor|fovVerticalDeg/.test(overlay),'labels are not parented to the world camera');
  assert(/screenPropPose\(pose, this\.buttonRef/.test(propsSrc),'buttons take the screen lock');
  assert(/sign\.setPosition\(S\.position\[0\], S\.position\[1\] - rise, S\.position\[2\]\)/.test(propsSrc),'sign stays on its sea post');
  assert(!/IslandRail|ShoreBreak|chess|BoardPanels/.test(propsSrc),'pull, waves and the board are untouched here');
});
console.log('ALL PASS',checks.length,'checks (tsc '+M.tsVersion+')');
