#!/usr/bin/env node
'use strict';
/* r5 彩虹桥 geometry / ground / look contract, on the REAL journey legs (journey-scene.cjs = RegionJourneyAdapter placement) and the
 * REAL GLB ground (bake-ground.cjs). Geometric + numeric evidence only; the Mac/真机 screenshots stay the visual acceptance.
 *  R1 shipped RainbowBridgeGround tables == a fresh bake from the GLBs (moved anchor / changed GLB → rerun the bake tool)
 *  R2 deck: one mesh per leg, closed simple rings wound for cullMode back (top faces up), on the controller centreline, sin² flat landings
 *  R3 no deck vertex under the real ground at the island / meadow / lakeside ends; visible part (fade ≥ .3) ≥ 1.2 cm up; island tongue on land
 *  R4 ends: 8×6-quad halo 2.5 cm over the real ground, 34 petals lying on it, 8 flowers on grass only (not path, deck, her walk)
 *  R5 motes ≤ 88 per leg (glow 20 + petals 12 per capped end + 24 curb); sky city (capless, plan B §8.4 pending) has none
 *  R6 look: alpha / saturation clearly under the concept, no seam term, night dimmer than day and never over-exposed */
const assert=require('node:assert/strict');
const BK=require('./bake-ground.cjs'),B=BK.bake(),{J,lk}=B,S=J.S;
const M=J.H.load(S+'region/RainbowBridgeMesh.ts'),G=J.H.load(S+'region/RainbowBridgeGround.ts').RAINBOW_GROUND,RBr=J.H.load(S+'region/RainbowBridge.ts');
const fs=require('node:fs');
const results=[];const check=(id,fn)=>{try{results.push({id,status:'PASS',...(fn()||{})});}catch(e){results.push({id,status:'FAIL',error:String(e.stack||e)});}};
const legs=[
 {id:'04-05 island→meadow',path:J.bridge1,ends:[RBr.rainbowEnd('island',J.bridge1[0],J.appr1),RBr.rainbowEnd('meadow',J.bridge1.at(-1),J.leg1.slice(J.appr1.length+J.bridge1.length-1))],ground:[B.ground.island,B.ground.meadow],ids:['island','meadow']},
 {id:'island→lakeside',path:lk.bridge,ends:[RBr.rainbowEnd('island',lk.bridge[0],lk.approach),RBr.rainbowEnd('lakeside',lk.bridge.at(-1),lk.arrival)],ground:[B.ground.island,B.ground.lakeside],ids:['island','lakeside']},
 {id:'08-09 meadow→sky city (capless until §8.4)',path:J.bridge2,ends:[null,null],ground:[null,null],ids:[null,null]},
];
const realGround=(objs,x,z,y0)=>{const h=B.hit(objs,x,z,y0);return h&&!h.water?h:null;};
check('R1 RainbowBridgeGround == fresh bake from the shipped GLBs (journey placement)',()=>{
 for(const id of ['island','meadow','lakeside']){const a=G[id],b=B.tables[id];assert.equal(a.frame,b.frame,id);assert.deepEqual([...a.at],b.at,id+' end moved');assert.equal(a.half,b.half);assert.equal(a.step,b.step);assert.equal(a.data,b.data,id+' ground changed — run node tools/rainbow-bridge/bake-ground.cjs --write');}
 assert.deepEqual(G.island.at.map(v=>+v.toFixed(4)),J.edge1.map(v=>+v.toFixed(4)),'island table sits on the REAL landing (islandApproach(exit_path_17)), not the stand-in terrain');
 const cls=t=>{const c={};for(let k=0;k<t.data.length;k+=3)c[t.data[k]]=(c[t.data[k]]||0)+1;return c;};
 return {cells:Object.fromEntries(Object.entries(G).map(([k,t])=>[k,cls(t)])),islandEnd:G.island.at};});
const ringPts=(g,r,n)=>{const v=j=>[g.positions[(r*n+j)*3],g.positions[(r*n+j)*3+1],g.positions[(r*n+j)*3+2]];const a=v(0),b=v(8);let X=b.map((x,i)=>x-a[i]);const l=Math.hypot(...X);X=X.map(x=>x/l);return Array.from({length:n},(_,j)=>{const p=v(j);return [(p[0]-a[0])*X[0]+(p[1]-a[1])*X[1]+(p[2]-a[2])*X[2],p[1]-a[1]];});};
check('R2 deck: one closed mesh per leg, simple clockwise rings (cull back = outside), top faces up, on the centreline, flat sin² landings',()=>{const rows=[];
 for(const leg of legs){const g=M.rainbowDeckGeometry(leg.path,leg.ends),n=M.RB.ringVerts,P=M.pathSampler(leg.path);
  assert.equal(g.positions.length/3,g.rings*n);assert(g.positions.length/3<65536,'16-bit indices');assert.equal(g.indices.length,(g.rings-1)*n*6);
  for(let r=0;r<g.rings;r++){const pts=ringPts(g,r,n);let A=0;for(let j=0;j<n;j++){const p=pts[j],q=pts[(j+1)%n];A+=p[0]*q[1]-q[0]*p[1];}assert(A<0,'ring '+r+' orientation');
   const o=(a,b,c)=>Math.sign((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;const a=pts[i],b=pts[(i+1)%n],c=pts[j],d=pts[(j+1)%n];assert(!(o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0),'ring '+r+' self-intersects');}}
  for(let r=0;r+1<g.rings;r++)for(let j=0;j<8;j++){const k=(r*n+j)*6,v=i=>[g.positions[i*3],g.positions[i*3+1],g.positions[i*3+2]];const a=v(g.indices[k]),b=v(g.indices[k+1]),c=v(g.indices[k+2]);const e1=b.map((x,i)=>x-a[i]),e2=c.map((x,i)=>x-a[i]);assert(e1[2]*e2[0]-e1[0]*e2[2]>0,'top face '+r+'/'+j+' faces down (would be culled from above)');}
  let dev=0;g.stations.forEach((s,i)=>{if(s<3.2||s>P.plan-3.2)return;const k=(i*n+4)*3,p=P.at(s);dev=Math.max(dev,Math.hypot(g.positions[k]-p[0],g.positions[k+1]-(p[1]-M.RB.feetM),g.positions[k+2]-p[2]));});assert(dev<.02,'centreline '+dev);
  const lin=t=>leg.path[0][1]+(leg.path.at(-1)[1]-leg.path[0][1])*t,N=leg.path.length-1,slope=i=>Math.atan2((leg.path[i+1][1]-lin((i+1)/N))-(leg.path[i][1]-lin(i/N)),Math.hypot(leg.path[i+1][0]-leg.path[i][0],leg.path[i+1][2]-leg.path[i][2]))*180/Math.PI;
  assert(Math.abs(slope(0))<2.5&&Math.abs(slope(N-1))<2.5,'arch slope at the landings '+slope(0)+' / '+slope(N-1)+' (sin(πt) was ≈15°)');
  rows.push({leg:leg.id,planM:+P.plan.toFixed(2),rings:g.rings,verts:g.positions.length/3,tris:g.indices.length/3,centreDevM:+dev.toFixed(4),archSlopeDegAtEnds:[+slope(0).toFixed(2),+slope(N-1).toFixed(2)]});}
 return {rows};});
check('R3 deck vs the REAL ground at the island / meadow / lakeside ends: nothing under it, visible part ≥ 1.2 cm up, island tongue lies on land',()=>{const rows=[];
 for(const leg of legs.slice(0,2)){const g=M.rainbowDeckGeometry(leg.path,leg.ends),P=M.pathSampler(leg.path);
  for(const which of [0,1]){let min=9,minVis=9,at=null;const objs=leg.ground[which];
   for(let i=0;i<g.positions.length/3;i++){const s=g.stations[Math.floor(i/M.RB.ringVerts)];if(which===0?s>P.plan/2:s<P.plan/2)continue;
    const x=g.positions[i*3],y=g.positions[i*3+1],z=g.positions[i*3+2],h=realGround(objs,x,z,y);if(!h)continue;const c=y-h.y;if(c<min){min=c;at=[x,y,z].map(v=>+v.toFixed(3));}if(g.colors[i*4+2]>=.3&&c<minVis)minVis=c;}
   assert(min>=0,leg.id+' '+leg.ids[which]+': deck vertex '+min.toFixed(4)+' m under the ground at '+JSON.stringify(at));
   assert(minVis>=M.RB.clearM-.001,leg.id+' '+leg.ids[which]+': visible deck only '+minVis.toFixed(4)+' m over the ground');
   rows.push({leg:leg.id,end:leg.ids[which],minClearM:+min.toFixed(4),minVisibleClearM:+minVis.toFixed(4)});}
  // island tongue: 0.8 m back onto the level island; its tip touches down (≤ 5 cm over the ground), not over the drop
  const t0=g.stations[0];assert(Math.abs(t0+RBr.RAINBOW_TONGUE_M.island)<1e-9);const tip=P.at(t0),h=realGround(leg.ground[0],tip[0],tip[2],tip[1]);
  assert(h&&Math.abs(h.y-tip[1])<.1,'tongue tip over land');const lowest=Math.min(...Array.from({length:M.RB.ringVerts},(_,j)=>g.positions[j*3+1]));assert(lowest-h.y<.05,'tongue rests on the ground '+(lowest-h.y));}
 return {rows};});
check('R4 ends: halo 2.5 cm over the real ground, 34 petals on it, 8 flowers on grass only (not path / deck / her walk)',()=>{const rows=[];
 for(const leg of legs.slice(0,2)){const g=M.rainbowGroundGeometry(leg.path,leg.ends);assert.equal(g.halos,2);assert.equal(g.petals,68);assert.equal(g.flowers,16,leg.id+' flowers '+g.flowers);
  const nv=g.positions.length/3;let haloErr=0,petalErr=0;const flowers=[];
  for(let i=0;i<nv;i++){const kind=g.normals[i*3+1],x=g.positions[i*3],y=g.positions[i*3+1],z=g.positions[i*3+2];
   const near=leg.ground.map(o=>realGround(o,x,z,y)).filter(Boolean).sort((a,b)=>Math.abs(a.y-y)-Math.abs(b.y-y))[0];
   if(kind===0&&g.colors[i*4+3]>.05&&near)haloErr=Math.max(haloErr,Math.abs(y-near.y-M.RB.haloLiftM));}
  // petals: 4-vertex rhombi in index order right after each 63-vertex halo; flowers: 14 vertices each (two stem quads + centre + 5 rim)
  let i=0;for(const which of [0,1]){i+=63;for(let p=0;p<34;p++,i+=4){const x=g.positions[i*3],y=g.positions[i*3+1],z=g.positions[i*3+2],h=realGround(leg.ground[which],x,z,y);assert(h,'petal over nothing');{const e=Math.abs(y-h.y-M.RB.petalLiftM);if(e>petalErr){petalErr=e;globalThis.__pw=[leg.ids[which],x,y,z,h.y,h.name];}}}
   for(let f=0;f<8;f++,i+=14){const x=g.positions[(i+8)*3],z=g.positions[(i+8)*3+2],y=g.positions[i*3+1]/* stem base */,h=realGround(leg.ground[which],x,z,y+.05);assert(h,'flower over nothing');flowers.push({end:leg.ids[which],x,z,on:h.name,ny:h.ny,dy:y-h.y});
    if(leg.ids[which]==='meadow')assert.equal(h.name,'meadow_terrain','meadow flower on '+h.name+' (grass only, never the path)');
    else if(leg.ids[which]==='island')assert(/^env_island_main/.test(h.name)&&h.ny>.97,'island flower on '+h.name+' ny '+h.ny);
    else assert.equal(h.name,'LK_terrain_i');
    assert(Math.abs(y-h.y)<.03,"flower stem base on the ground "+(y-h.y)+" "+leg.ids[which]+" "+JSON.stringify([x,y,z])+" "+h.name);
    const end=leg.path[which?leg.path.length-1:0],Pp=M.pathSampler(leg.path),dir=which?Pp.endDir.map(v=>-v):Pp.startDir,u=(x-end[0])*dir[0]+(z-end[2])*dir[1],l=Math.abs(-(x-end[0])*dir[1]+(z-end[2])*dir[0]);
    assert(!(u>-RBr.RAINBOW_TONGUE_M[leg.ids[which]]-.3&&l<M.RB.width/2+M.RB.flareM+.3),'flower under the deck '+JSON.stringify({end:leg.ids[which],u,l,f}));
    const walk=leg.ends[which].avoid;assert(walk.every(a=>Math.hypot(a[0]-x,a[2]-z)>=.6),'flower on her walk');}}
  assert.equal(i,nv,'vertex layout');assert(haloErr<.03,'halo lift error '+haloErr);assert(petalErr<.02,'petal lift error '+petalErr+' '+JSON.stringify(globalThis.__pw));
  rows.push({leg:leg.id,tris:g.indices.length/3,haloLiftErrM:+haloErr.toFixed(4),petalLiftErrM:+petalErr.toFixed(4),flowersOn:[...new Set(flowers.map(f=>f.on))]});}
 return {rows};});
check('R5 motes: 88 per capped leg (20 glow + 12 petals per end + 24 curb), none on the capless sky leg; bounds hold the motion',()=>{const rows=[];
 for(const leg of legs){const d=M.rainbowDeckGeometry(leg.path,leg.ends),m=M.rainbowMotesGeometry(leg.path,leg.ends,d);assert(m.count.total<=M.RAINBOW_PARTICLES.max);
  if(leg.ends[0])assert.deepEqual(m.count,{glow:40,petals:24,curb:24,total:88});else assert.equal(m.count.total,0);
  for(let i=0;i<m.positions.length/3;i++){const k=m.normals[i*3+1],w=m.colors[i*4+3],y=m.positions[i*3+1];if(k===1)assert(y+w<=m.maxPos.y+1e-9,'rise inside bounds');if(k===2)assert(y-w>=m.minPos.y-1e-9,'fall inside bounds');}
  rows.push({leg:leg.id,...m.count});}
 assert.equal(M.RAINBOW_PARTICLES.glowPerEnd*2+M.RAINBOW_PARTICLES.petalsPerEnd*2+M.RAINBOW_PARTICLES.curb,88);return {rows};});
check('R6 look: paler and more transparent than the concept, no seams, night dimmer than day and not over-exposed',()=>{
 const L=M.RAINBOW_LOOK,day=M.rainbowLook(0),night=M.rainbowLook(1);
 assert(L.day.alpha<=.6&&L.day.alpha<=L.concept.alpha-.3,'day alpha '+L.day.alpha);assert(L.night.alpha<=L.day.alpha,'night alpha');
 assert(L.day.saturation<=.65&&L.night.saturation<=.65,'saturation');assert(night.deck[0]<day.deck[0]&&night.deck[0]<L.concept.nightEmit,'night emit');
 const fx=fs.readFileSync(J.ROOT+'/creator-build-project/assets/resources/world/rainbow-bridge.effect','utf8').replace(/\/\/[^\n]*/g,'');assert(!/seam/i.test(fx),'seam term removed from the deck effect');
 // brightest possible deck fragment (emulates rb-fs: pale band, curb white-gold, max facet light × curb shade 1.15, streak + sparkle peaks)
 const emu=(w,bg)=>{const look=M.rainbowLook(w).deck;let worst=0,see=1;for(let u=0;u<=1;u+=1/60)for(const curb of [0,1]){let c=M.bandColor(u);const l=.299*c[0]+.587*c[1]+.114*c[2];c=c.map(v=>(l+(v-l)*look[2])*(1-.18)+.18);
   if(curb)c=c.map((v,i)=>v+([1,.95,.82][i]-v)*.55);const lit=(0.82+0.22)*(curb?1.15:1);c=c.map(v=>v*lit+(curb?0:L.flow.streak+L.flow.sparkle));c=c.map(v=>Math.min(1,v*look[0]));
   const a=Math.min(1,look[1]+(curb?.1:0)),out=c.map((v,i)=>v*a+bg[i]*(1-a));worst=Math.max(worst,...out);see=Math.min(see,1-a);}return {worst,see};};
 const nightBg=[.06,.08,.14],dayWater=[.36,.78,.86],n=emu(1,nightBg),d=emu(0,dayWater);
 assert(n.worst<=.75,'night deck pixel '+n.worst+' (no over-exposure)');assert(d.see>=.4,'day: ≥ 40 % of the water/grass shows through, got '+d.see);
 // halo + motes are additive: brightest night halo vertex over the night ground stays well under white
 const halo=Math.max(...M.paleBand(0).concat(M.paleBand(1)))*.9*night.ends[0];assert(halo<=.45,'night halo add '+halo);
 return {day:{deck:day.deck,ends:day.ends,worstPixelOverWater:+d.worst.toFixed(3),showThrough:+d.see.toFixed(2)},night:{deck:night.deck,ends:night.ends,worstPixelOverNight:+n.worst.toFixed(3),haloAdd:+halo.toFixed(3)},concept:L.concept};});
const out={suite:'rainbow-bridge-mesh',results,summary:{total:results.length,passed:results.filter(r=>r.status==='PASS').length}};
console.log(JSON.stringify(out,null,1));if(out.summary.passed!==out.summary.total)process.exitCode=1;
