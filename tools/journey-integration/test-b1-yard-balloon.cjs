'use strict';
// full9c B1 yard balloon (Grok Bot 2026-10-29 approval of 98d80188, conditions 1–3):
//  1 placed at meadow start, off camera (stand-in at the meadow mount; ride vehicle swap = same pose, same sync block; never shown in view)
//  2 clear of her walk/body (>=0.3 m beyond a 0.25 m body radius) and of the camera->her sight line over the pre-walk
//  3 B1 first frame unchanged vs 19bd812a (vehicle pose, envelope, camera; hold branch not taken)
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const ROOT=path.join(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts/'),BASE='19bd812a';
global.__QF_BALLOON_FLIGHT=JSON.parse(fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json'),'utf8'));
const H=require(path.join(ROOT,'tools/board-ui/harness.cjs')).createHarness();
const TL=H.load(S+'region/TransportLeg.ts'),BF=H.load(S+'region/BalloonFlight.ts'),BT=H.load(S+'region/BalloonTransit.ts'),B1S=H.load(S+'region/BalloonB1Start.ts');
const TS=H.load(S+'region/TransitionStaging.ts'),TC=H.load(S+'region/TransitionChain.ts'),RN=H.load(S+'region/RegionNodes.ts');
const src=fs.readFileSync(S+'region/BalloonTransit.ts','utf8'),adapter=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');
const Y=BT.YARD_BALLOON,ST=TS.TRANSITION_STAGING.meadow,INF=TC.INFLATE;
const M2={yawDeg:180,origin:[-1.7,-1.35,79.1]}/* m run [QF_B1_PREWALK] meadowPos/meadowWorldYaw */;
const frameFns=f=>{const r=f.yawDeg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return {w:p=>[f.origin[0]+c*p[0]+s*p[2],f.origin[1]+p[1],f.origin[2]-s*p[0]+c*p[2]],
 l:p=>{const d=[p[0]-f.origin[0],p[1]-f.origin[1],p[2]-f.origin[2]];return [c*d[0]-s*d[2],d[1],s*d[0]+c*d[2]];}};};
const planFor=f=>TL.balloonBeats(frameFns(f).w(BF.M6_LOCAL),BF.S0_LOCAL,[0,0,0],{meadowFrame:f,walkInM:0,walkOutM:0});
const gitShow=f=>{try{return execFileSync('git',['-C',ROOT,'show',BASE+':creator-build-project/assets/scripts/'+f],{encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{return null;}};
const res={};
// ---------- condition 1 ----------
{const at=adapter.indexOf("if(to==='meadow'){"),blk=adapter.slice(at,at+200);
 assert.match(blk,/^if\(to==='meadow'\)\{\s*mountYardBalloon\(model\)/,'C1: yard stand-in not mounted first thing in the journey meadow mount (all meadow entries)');
 assert.doesNotMatch(adapter,/await\s+mountYardBalloon/,'C1: stand-in must not be awaited (0 s on island->meadow)');
 assert.ok(adapter.indexOf('mountYardBalloon(model)')>adapter.indexOf('if(warmed){'),'C1: stand-in must go on the final (warm) meadow model');
 for(const f of [M2,{yawDeg:0,origin:[0,0,0]},{yawDeg:37,origin:[3,-2,11]}]){const v=planFor(f).vehicle(0),loc=frameFns(f).l(v.pos);
  for(let i=0;i<3;i++)assert.ok(Math.abs(loc[i]-Y.pos[i])<0.02,`C1: stand-in pos != B1 t=0 vehicle (frame ${f.yawDeg}): ${loc} vs ${Y.pos}`);
  const dy=(((v.yaw*180/Math.PI-f.yawDeg-Y.yawDeg)%360)+540)%360-180;assert.ok(Math.abs(dy)<0.05,'C1: stand-in yaw != B1 t=0 yaw '+dy);assert.ok(Math.abs(v.roll)<1e-9,'C1: roll');}
 assert.deepEqual([...Y.pos],[...ST.launch],'C1: stand-in != staging launch');assert.equal((ST.basketYawLocalDeg+360)%360,Y.yawDeg);
 const i0=src.indexOf('if(contChain){const w0=plan.vehicle(0);'),one=src.slice(i0,src.indexOf('director.on(Director.EVENT_BEFORE_DRAW,b1BeforeDraw);',i0));
 assert.ok(i0>0&&!/await/.test(one),'C1: swap not in the placement sync block');
 assert.ok(one.indexOf('applyInflate()')>0&&one.indexOf('yd.active=false')>one.indexOf('applyInflate()'),'C1: stand-in must hide after the ride vehicle is placed+deflated');
 assert.ok(i0<src.indexOf("await actor.perform({kind:'walk',path:pre.path"),'C1: swap must precede the pre-walk');
 assert.match(src,/if\(!meadow\.activeInHierarchy\|\|outsideView\(liveWorldPose\(\),/,'C1: stand-in may only appear hidden or out of view');
 const yc=frameFns(M2).w([Y.pos[0],Y.pos[1]+Y.centerUpM,Y.pos[2]]),rows=[];
 for(const line of fs.readFileSync(path.join(ROOT,'tools/transitions-continuous/fixtures/m2-camtrace-full.txt'),'utf8').split('\n')){
  const m=/f=(\d+) t=([\d.]+) pos=([-\d.]+),([-\d.]+),([-\d.]+) yaw=([-\d.]+) pitch=([-\d.]+) fov=([\d.]+) w=(\S+)/.exec(line);if(!m)continue;
  const [x,y,z,yw,pt,fov]=m.slice(3,9).map(Number),a=yw*Math.PI/180,p=pt*Math.PI/180,F=[Math.sin(a)*Math.cos(p),Math.sin(p),-Math.cos(a)*Math.cos(p)]/* CamTraceLog yaw=atan2(fx,-fz) */;
  rows.push({f:+m[1],t:+m[2],w:m[9],cam:{position:[x,y,z],target:[x+F[0],y+F[1],z+F[2]],fovVerticalDeg:fov}});}
 const pre=rows.find(r=>r.w==='BalloonTransit:prewalk'),sail=rows.find(r=>r.w==='LiveHandoff'),b1=rows.find(r=>r.w==='BalloonTransit:B1');
 assert.equal(BT.outsideView(pre.cam,yc),false,'C1 fixture: expected the yard in view at pre-walk start (98d80188 pop-in case)');
 assert.equal(BT.outsideView(b1.cam,yc),false,'C1 fixture: B1 must see the balloon');
 const LOAD_S=3;const show=rows.find(r=>r.t>=sail.t+LOAD_S&&r.f<pre.f&&BT.outsideView(r.cam,yc));
 assert.ok(show,'C1: no out-of-view frame between meadow mount+load and pre-walk start');
 res.c1={popInAt98d80188:{f:pre.f,t:pre.t,inView:true},standInShowFrame:{f:show.f,t:show.t,w:show.w},secondsBeforePrewalk:+(pre.t-show.t).toFixed(2)};}
// ---------- condition 2 ----------
{const deg=Y.yawDeg*Math.PI/180,c=Math.cos(deg),s=Math.sin(deg);const toB=p=>{const d=[p[0]-Y.pos[0],p[2]-Y.pos[2]];return [c*d[0]-s*d[1],s*d[0]+c*d[1]];};
 const envR=2.897777557373047*INF.flatXZ/* GLB envelope half-width × flat */,envTop=3.05+(10.4-3.05)*INF.flatY;
 const rect=(q,x0,x1,z0,z1)=>Math.hypot(Math.max(x0-q[0],0,q[0]-x1),Math.max(z0-q[1],0,q[1]-z1));
 const footDist=p=>{const q=toB(p);return Math.min(Math.hypot(q[0],q[1])-envR,rect(q,-0.9364,0.9364,-0.84,0.84),rect(q,-0.4,0.4,0.84,1.0131),rect(q,-0.4,0.4,-1.0131,-0.84));};
 const BODY_R=0.25,NEED=0.3;const seg=(a,b,fn,step=0.05)=>{let m=Infinity;const L=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),n=Math.max(1,Math.ceil(L/step));for(let i=0;i<=n;i++){const t=i/n;m=Math.min(m,fn([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]));}return m;};
 const G=RN.REGION_NODES.meadow,walks=[];let minWalk=Infinity,worst=null;
 // walks with the yard balloon present: every pre-walk (any node → gate) and every meadow edge, M6 edges cut at the gate (B1's door walk enters the basket by design)
 for(const n of G.nodes){const pw=B1S.b1PreWalk(n.at,undefined);if(pw)walks.push({k:'prewalk:'+n.key,path:pw.path});}
 for(const e of G.edges){let p=e.path.slice();if(e.a==='M6')p=p.reverse();if(e.a==='M6'||e.b==='M6')p=B1S.cutAtHandoff(p);walks.push({k:'edge:'+e.a+'-'+e.b,path:p});}
 for(const w of walks)for(let i=1;i<w.path.length;i++){const d=seg(w.path[i-1],w.path[i],footDist)-BODY_R;if(d<minWalk){minWalk=d;worst=w.k;}}
 res.c2={bodyRadiusM:BODY_R,minWalkClearanceM:+minWalk.toFixed(3),worstWalk:worst,walks:walks.length};
 const inside=p=>{const y=p[1]-Y.pos[1];if(y<-0.03||y>Math.max(envTop,3.0719))return false;return footDist(p)<0;};
 const c0=planFor(M2).camera(0),{w,l}=frameFns(M2);let minSight=Infinity,sightWorst=null,blocked=0,samples=0;
 for(const wk of walks.filter(x=>x.k.startsWith('prewalk:'))){const P=wk.path.map(w),L=[0];for(let i=1;i<P.length;i++)L.push(L[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]));
  const T=L[L.length-1]/1.2;let st=null;for(let t=0;t<=T;t+=1/30){const u=t*1.2;let i=1;while(i<P.length-1&&L[i]<u)i++;const k=Math.max(0,Math.min(1,(u-L[i-1])/Math.max(1e-9,L[i]-L[i-1]))),her=[0,1,2].map(j=>P[i-1][j]+(P[i][j]-P[i-1][j])*k);
   const yaw=Math.atan2(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2])/* followPose: facing (sin,cos) */;const r=B1S.b1PreWalkLens({her,yawRad:yaw,w:390,h:844,dt:1/30,t,durationS:T,live:null,c0,prev:st});st=r.state;
   const chest=[her[0],her[1]+1.2,her[2]],cam=r.pose.position;samples++;let m=Infinity;
   for(let q=0;q<=60;q++){const p=l([0,1,2].map(j=>cam[j]+(chest[j]-cam[j])*q/60));if(inside(p)){m=-1;break;}m=Math.min(m,Math.max(footDist(p),p[1]-Y.pos[1]-envTop));}
   if(m<0)blocked++;if(m<minSight){minSight=m;sightWorst=wk.k+'@'+t.toFixed(2)+'s';}}}
 Object.assign(res.c2,{sightSamples:samples,sightBlocked:blocked,minSightClearanceM:+minSight.toFixed(3),sightWorst});
 assert.ok(minWalk>=NEED,`C2: her body is ${minWalk.toFixed(3)} m from the moored balloon on ${worst} (< ${NEED})`);
 assert.equal(blocked,0,`C2: balloon blocks the camera->her sight line on ${blocked}/${samples} pre-walk frames (worst ${sightWorst})`);}
// ---------- condition 3 ----------
{const base=gitShow('region/BalloonTransit.ts');
 if(base){const pick=(s,a,b)=>{const i=s.indexOf(a);assert.ok(i>=0,'C3: missing '+a);return s.slice(i,s.indexOf(b,i));};
  for(const [a,b] of [['const applyInflate=()=>{','};'],['const cam0=plan.camera(0)','\n'],['const b1Lens=():Pose=>','\n'],['const plan=balloonBeats(','\n'],['let inflateT=','\n']])
   assert.equal(pick(src,a,b),pick(base,a,b),'C3: B1 first-frame code changed vs '+BASE+': '+a);
  const body=s=>{const i=s.indexOf('const b1Draw=()=>{');return s.slice(i,s.indexOf('director.on(Director.EVENT_BEFORE_DRAW,b1Draw)',i)).replace(/\n\s*if\(!b1Drawn\)\{gapPh\('firstDraw-wait'\);[\s\S]*?\/\* hold the real previous frame, single writer \(before-draw\) \*\//,'');};
  assert.equal(body(src),body(base),'C3: B1 writer changed beyond the hold branch');}
 for(const f of ['region/TransportLeg.ts','region/BalloonFlight.ts','region/TransitionChain.ts','region/BalloonB1Start.ts','region/BasketCloseShot.ts']){const b=gitShow(f);if(b!==null)assert.equal(fs.readFileSync(S+f,'utf8'),b,'C3: '+f+' changed vs '+BASE);}
 const plan=planFor(M2),v0=plan.vehicle(0),c0=plan.camera(0),PIN={v0:[-5.3,5.25,102.5],c0:[-20.6,8.25,89.6]}/* m run plan0 (3 dp log) */;
 for(let i=0;i<3;i++){assert.ok(Math.abs(v0.pos[i]-PIN.v0[i])<0.06,'C3 v0 '+v0.pos);assert.ok(Math.abs(c0.position[i]-PIN.c0[i])<6e-4,'C3 cam0 '+c0.position);}
 const o={p:{x:0,y:-3.05,z:0},s:{x:1,y:1,z:1}},e={get position(){return {...o.p,clone(){return {...o.p};}};},get scale(){return {...o.s,clone(){return {...o.s};}};},setScale(x,y,z){o.s={x,y,z};},setPosition(x,y,z){o.p={x,y,z};},getComponents(){return [{mesh:{struct:{minPosition:{y:3.05}}}}];}};
 BT.yardEnvelope(e,0);const f0=TC.inflateAt(0),wantY=-3.05+3.05*(1-f0.sy),eps=1e-9;
 assert.ok(Math.abs(o.s.x-f0.sxz)<eps&&Math.abs(o.s.y-f0.sy)<eps&&Math.abs(o.s.z-f0.sxz)<eps&&Math.abs(o.p.y-wantY)<eps,'C3: stand-in envelope != applyInflate(0)');
 assert.ok(src.indexOf('director.on(Director.EVENT_AFTER_DRAW,b1AfterDraw)')<src.indexOf("await actor.perform({kind:'walk',path:pre.path"),'C3: first-draw listener after the pre-walk');
 res.c3={base:BASE,codeCompared:!!base,v0:v0.pos.map(x=>+x.toFixed(4)),yawDeg:+(v0.yaw*180/Math.PI).toFixed(4),cam0:c0.position,envelope:{sxz:f0.sxz,sy:f0.sy,y:+wantY.toFixed(6)}};}
console.log(JSON.stringify(res));console.log('b1-yard-balloon: PASS');
