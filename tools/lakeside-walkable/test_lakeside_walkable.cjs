'use strict';
// b16 P1-3 regression (+ b16 decision 2026-10-22): free explore has a walkable area in 风铃湖畔, 草原 and 天空城 (and the island),
// ground taps walk on it, drag orbits the lens there, it only opens after a board exit (never during landing / cutscene shots),
// the lakeside boardwalk joins the near shore to the far shore and the bridge, and nearestWalkable() answers for 运镜bot.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {load,ROOT,SCRIPTS}=require('../region-nodes/load.cjs');
const RW=load('region/RegionWalkable.ts'),W=load('region/LakesideWalkable.ts'),X=load('region/LakesideExplore.ts'),I=load('world-r2/ExploreInput.ts');
const RN=load('region/RegionNodes.ts'),O=load('region/FreeOrbit.ts'),SD=load('region/LakesideSceneData.ts'),CL=load('region/LakesideCameraLayout.ts');

// 1. data is the bake of the shipped GLBs / r5h3 transforms (no drift)
const chk=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/region-walkable/bake-region-walkable.cjs'),'--check'],{encoding:'utf8'});
assert.equal(chk.status,0,'region walkable drift: '+chk.stderr+chk.stdout);

// 2. all four regions configured, one source
const cells={};
for(const r of ['island','meadow','skycity','lakeside']){
 assert.equal(I.EXPLORE_WALKABLE[r],'region-walkable',r);
 const g=RW.walkGrid(r);let n=0;for(const h of g.h)if(!Number.isNaN(h))n++;cells[r]=n;
}
assert.ok(cells.island>2000&&cells.meadow>15000&&cells.skycity>15000&&cells.lakeside>8000,JSON.stringify(cells));
for(const r of ['island','meadow','skycity']){assert.equal(RN.REGION_NODES[r].exploreBox.length,4);assert.equal(X.stageGraph(r),RN.REGION_NODES[r]);}
assert.ok(Array.isArray(I.SCENE_PROPS.lakeside));
assert.equal(X.stageGraph('lakeside').nodes[0].key,'L0');

// 3. meadow / skycity: every story node stands on (or within 1.2 m of) the walkable area, paths between nodes exist and stay on it,
//    outside the explore box is never walkable
for(const r of ['meadow','skycity']){
 const G=RN.REGION_NODES[r],nodes=G.nodes,box=G.exploreBox;
 for(const n of nodes){const h=RW.nearestWalkable(r,n.at,1.2);assert.ok(h,r+' node '+n.key+' off the walkable area');}
 for(let i=1;i<nodes.length;i++){
  const a=RW.nearestWalkable(r,nodes[0].at,1.2).at,b=RW.nearestWalkable(r,nodes[i].at,1.2).at,p=RW.walkPath(r,a,b);
  assert.ok(p&&p.length>=2,r+' no path '+nodes[0].key+'→'+nodes[i].key);
  for(let k=1;k<p.length;k++)assert.ok(RW.lineWalkable(r,p[k-1],p[k]),r+' path leg off the area '+nodes[i].key);
 }
 const cx=(box[0]+box[2])/2,cz=(box[1]+box[3])/2;
 assert.equal(RW.isWalkable(r,box[0]-3,cz),false,r+' west of box');assert.equal(RW.isWalkable(r,box[2]+3,cz),false,r+' east of box');
 assert.equal(RW.isWalkable(r,cx,box[1]-3),false,r+' north of box');assert.equal(RW.isWalkable(r,cx,box[3]+3),false,r+' south of box');
 // a tap straight down onto a node lands on walkable ground
 const n0=nodes[0].at,hit=RW.walkRayHit(r,[n0[0],n0[1]+12,n0[2]+6],[0,-12,-6]);
 assert.equal(hit.kind,'walk',r+' ground tap');
}
// meadow: not every cell is walkable (house / rocks / trees cut out); skycity: no floor under the void
assert.ok(cells.meadow<RW.walkGrid('meadow').W*RW.walkGrid('meadow').H);
assert.equal(RW.walkRayHit('skycity',[0,-10,0],[0,-1,0]).kind,'none');

// 4. lakeside: water is never walkable (every board cell, the open lake)
const g=W.lakesideWalkGrid();
for(let i=0;i<49;i++){const c=SD.lakesideCellCenter(i);assert.equal(W.lakesideWalkable(c[0],c[2]),false,'board cell '+i+' walkable');}
for(const p of [[0,-20],[10,20],[-10,18],[0,5],[0,-5],[20,10]])assert.equal(W.lakesideWalkable(p[0],p[1]),false,'water '+p);
for(let k=0;k<g.h.length;k++)if(!Number.isNaN(g.h[k]))assert.ok(g.h[k]>W.LAKESIDE_WATER_Y+0.05,'cell at water level '+k);

// 5. lakeside: grass, bridge deck and the b16 boardwalk (x=-13, z 2.5..24.5, deck ≈0.585) are walkable
const stop=CL.LAKESIDE_CAMERA_LAYOUT.stopLocal;
assert.ok(W.lakesideWalkable(stop[0],stop[2]),'landing stop');
for(const p of [[1.2,24.5],[1.2,30],[-6,28],[8,26]])assert.ok(W.lakesideWalkable(p[0],p[1]),'grass '+p);
const deck=W.lakesideFloorY(0,0);assert.ok(deck!==null&&deck>2.5,'bridge deck '+deck);
assert.ok(W.lakesideWalkable(-5,0)&&W.lakesideWalkable(5,0),'bridge span');
let bw=0;for(let z=4;z<=22;z+=.5){const y=W.lakesideFloorY(-13,z);if(y!==null){bw++;assert.ok(Math.abs(y-.585)<.1,'boardwalk deck y '+y+' @'+z);}}
assert.ok(bw>=28,'boardwalk walkable samples '+bw);
const tr=JSON.parse(fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_lakeside/scene_r5h_slim_transforms.json'),'utf8'));
const insts=(tr.instances||tr.objects||[]).filter(o=>/^LK_boardwalk_b16_/.test(o.name||''));
assert.equal(insts.length,11,'boardwalk instances');
for(const o of insts){const x=o.pos[0],z=o.pos[2];assert.ok(Math.abs(x)>9||Math.abs(z-12)>6,'boardwalk in the board area '+o.name);}

// 6. ground taps from the board lens; water answers 'water', grass answers 'walk'
const eye=[0,13.2,26.5];
assert.equal(W.lakesideRayHit(eye,[0-eye[0],0-eye[1],12-eye[2]]).kind,'water');
const toGrass=W.lakesideRayHit(eye,[-6-eye[0],0.6-eye[1],28-eye[2]]);assert.equal(toGrass.kind,'walk');
assert.ok(Math.hypot(toGrass.at[0]+6,toGrass.at[2]-28)<0.5);

// 7. walk paths stay on land/deck; the far shore and the bridge are reachable over the boardwalk; the board water never
for(const t of [[-6,.6,28],[8,.6,26],[1.2,.6,30],[-15,.6,32],[0,deck,0]]){const p=W.lakesidePath(stop,t);assert.ok(p&&p.length>=2,'no path to '+t);
 for(let i=1;i<p.length;i++)assert.ok(W.lakesideLineWalkable(p[i-1],p[i]),'path leg over water '+t);
 assert.ok(Math.hypot(p[p.length-1][0]-t[0],p[p.length-1][2]-t[2])<0.6);}
const far=W.lakesidePath(stop,[0,deck,0]);assert.ok(far.some((q,i)=>i>0&&Math.abs(q[0]+13)<1.5&&Math.abs(far[i-1][0]+13)<1.5&&Math.abs(q[2]-far[i-1][2])>12),'far shore not reached via the boardwalk');
assert.equal(W.lakesidePath(stop,[0,0,12]),null,'walked onto the board water');

// 8. nearestWalkable (运镜bot snap): water → nearest shore/deck, exact hits report exact, nothing within radius → null
const s0=RW.nearestWalkable('lakeside',[stop[0],stop[1],stop[2]]);assert.ok(s0&&s0.exact&&s0.distanceM<.3);
const s1=RW.nearestWalkable('lakeside',[-13.6,0,12],2);assert.ok(s1&&!s1.exact&&RW.isWalkable('lakeside',s1.at[0],s1.at[2]),'snap off water onto the boardwalk');
assert.equal(RW.nearestWalkable('lakeside',[0,0,12],1),null,'board centre has no floor within 1 m');
const s2=RW.nearestWalkable('lakeside',[0,0,12],12);assert.ok(s2&&s2.distanceM<=12);

// 9. explore opens after a board exit (暂停 →「离开棋盘」) in meadow / skycity / lakeside, never during the arrival shot
assert.deepEqual([...X.EXIT_EXPLORE_REGIONS].sort(),['island','lakeside','meadow','skycity']);
// b17 r7 ③: the island joins free explore after a board exit (island boards: no journey of their own)
{const ok={state:'island',hidden:false,needsResume:false,characterReady:true};
 assert.equal(X.exploreWanted('island',ok),true,'island stand');
 assert.equal(X.exploreWanted('island',{...ok,journey:{region:'meadow',phase:'travel'}}),false,'island mid journey');
 assert.equal(X.exploreWanted('island',{...ok,hidden:true}),false);assert.equal(X.exploreWanted('island',{...ok,state:'level'}),false);
 let a=X.exploreArm('island','home-exit',ok,false);assert.equal(a,false,'walk-out arrival must not arm');
 a=X.exploreArm('island','island',{state:'level'},a);assert.equal(a,true,'island board arms');
 a=X.exploreArm('island','level',ok,a);assert.equal(a,true,'board exit keeps armed');
 assert.equal(X.exploreArm('island','level',{state:'meadow'},a),false,'leaving island disarms');
 assert.equal(X.exploreArm('island','meadow',{state:'level',journey:{region:'meadow',phase:'arrived'}},false),false,'meadow board does not arm island');
 // ground tap straight down onto the island character spawn lands on walkable ground (island local = world)
 const c=[-2.1135,0,5.2814],h=RW.walkRayHit('island',[c[0],c[1]+12,c[2]+6],[0,-12,-6]);assert.equal(h.kind,'walk','island ground tap '+JSON.stringify(h));
 const f=RW.nearestWalkable('island',c,1.6);assert.ok(f,'island spawn walkable');
 // tap out to sea = water
 const w=RW.walkRayHit('island',[c[0],8,c[2]],[0,-8.6,60]);assert.notEqual(w.kind,'walk','island sea tap '+JSON.stringify(w));
 console.log('island explore ok',JSON.stringify({spawn:f.at,tap:h.kind,sea:w.kind}));}
for(const r of ['meadow','skycity','lakeside']){
 const arrived={state:r,hidden:false,needsResume:false,journey:{region:r,phase:'arrived'}};
 assert.equal(X.exploreWanted(r,arrived),true,r);
 assert.equal(X.exploreWanted(r,{...arrived,journey:{region:r,phase:'arrival'}}),false,r+' landing shot');
 assert.equal(X.exploreWanted(r,{...arrived,state:'level'}),false,r+' on the board');
 assert.equal(X.exploreWanted(r,{...arrived,needsResume:true}),false,r);
 assert.equal(X.exploreWanted(r,{...arrived,hidden:true}),false,r+' hidden (cutscene)');
 let armed=X.exploreArm(r,null,arrived,false);assert.equal(armed,false,r+' arrival must not arm');
 armed=X.exploreArm(r,r,{state:'level',journey:{region:r,phase:'arrived'}},armed);assert.equal(armed,true,r);
 armed=X.exploreArm(r,'level',arrived,armed);assert.equal(armed,true,r+' board exit keeps armed');
 assert.equal(X.exploreArm(r,r,{state:'island'},armed),false,r);
}
assert.equal(X.lakesideExploreWanted({state:'lakeside',hidden:false,needsResume:false,journey:{region:'lakeside',phase:'arrived'}}),true);

// 10. drag: a 10 pt move in explore is a drag, and the orbit turns under it
assert.equal(I.classifyPointers({uiHit:false,pointers:1,movedPt:40,heldS:.3,boardOpen:false,blending:false,explore:true}),'drag');
assert.equal(I.classifyPointers({uiHit:false,pointers:1,movedPt:2,heldS:.1,boardOpen:false,blending:false,explore:true}),'tap');
const orbit=new O.FreeOrbit('lakeside');
orbit.seed({position:[0,13.2,26.5+12],target:[stop[0],stop[1]+1,stop[2]],fovVerticalDeg:48},[stop[0],stop[1],stop[2]]);
const y0=orbit.yaw;orbit.drag(0.2,0);assert.ok(Math.abs(orbit.yaw-y0)>1e-3,'drag did not turn the lakeside orbit');

// 11. stage wiring (source)
const src=fs.readFileSync(path.join(SCRIPTS,'world-r2/RegionNodeStage.ts'),'utf8');
assert.match(src,/if\(this\.region==='lakeside'\)\{this\.groundTap\(x,y\);return;\}/);
assert.match(src,/if\(this\.region==='meadow'\|\|this\.region==='skycity'\|\|this\.region==='island'\)this\.groundTap\(x,y\)/);
assert.match(src,/walkMatrix\(region:StageRegion\):Mat4\|null\{if\(region==='island'\)return new Mat4\(\)/);
assert.match(src,/update\(dt:number\)\{\n  this\.syncExplore\(dt\);/);
assert.match(src,/this\.openExplore\(r,true(,snapped)?\)/);
assert.match(src,/if\(this\.region==='lakeside'\)return undefined;const G=stageGraph\(this\.region\)/);/* r17 + skycity-walk-r2: lensBox??exploreBox through toWorld */
assert.match(src,/b=G\.lensBox\?\?G\.exploreBox;\n\s*const c=this\.toWorld\(this\.region/);
assert.match(src,/LakesideJourneyScene/);
// pause label (b16 decision): 「离开棋盘」, same Home action
const bp=fs.readFileSync(path.join(SCRIPTS,'ui/BoardPanels.ts'),'utf8');
assert.match(bp,/p\.button\('secondary', '离开棋盘', 0, 700, 480, 96, \(\) => a\.home\(\)/);
assert.doesNotMatch(bp,/'回到小岛'/);
console.log('region-walkable ok cells',JSON.stringify(cells));

// b17 skycity-walk (web p0drag3: 天空城点地面不走): the r5 exploreBox [-30,-45,25,55] cut ~620 m² of connected y≈0 floor off the
// walkable area (east of S3, west rim). The box now encloses the whole flood-filled plateau; taps there walk from S3.
{const sb=RN.REGION_NODES.skycity.exploreBox;assert.ok(sb[0]<=-36&&sb[2]>=41.5,'skycity exploreBox encloses the plateau '+JSON.stringify(sb));
 const S3=RW.nearestWalkable('skycity',[6.2,-0.01,8.2],1.2).at;
 for(const p of [[33,0,0],[35,0,10],[30,0,-10],[38,0,5],[-33,0,10]]){
  const n=RW.nearestWalkable('skycity',p,0.5);assert.ok(n,'skycity '+p+' walkable');
  const a=n.at,hit=RW.walkRayHit('skycity',[a[0],a[1]+12,a[2]+6],[0,-12,-6]);assert.equal(hit.kind,'walk','skycity tap '+p+' '+JSON.stringify(hit));
  const w=RW.walkPath('skycity',S3,n.at);assert.ok(w&&w.length>=2,'skycity path S3->'+p);}
 console.log('skycity plateau ok');}

// b17 skycity-walk-r2 (Mac p0drag6): taps around S3. E3 used to land on the 0.2 m ruin wall top (y 1.17) and walk 25.85 m round
// through the porch; W taps on the planter west of her returned 'none'. Wall tops are not floor now, a tap on a planter walks to
// the floor in front of it, the lens has its own world-converted box and proxies for the merged sky houses.
{const r='skycity',P=(a,b)=>{const p=RW.walkPath(r,a,b);return p?RW.walkPathLengthM(p):Infinity;};
 assert.equal(RW.walkFloorY(r,13.3,9.16)===null||RW.walkFloorY(r,13.3,9.16)<.5,true,'ruin wall top is not floor');
 // r4 方案 C: E2 (13.13,7.61) / E3 (13.2,8.6–9.2) are inside the pocket that is no longer walkable; the walk along its west edge stays short
 assert.ok(P([11.8,-0.06,7.4],[11.79,-0.01,8.96])<2,'pocket west edge near straight');
 // r4: arm 3 m, the lens pulls in in front of the blue-roof house proxies; a 7.5 m arm east of W0 sits inside the house and the
 // voxel field (rightly) stops that ray on the house
 const cam=(her,t)=>{let dx=t[0]-her[0],dz=t[2]-her[2],L=Math.hypot(dx,dz);dx/=L;dz/=L;const k=3*Math.cos(25*Math.PI/180);return [her[0]-dx*k,her[1]+1.2+3*Math.sin(25*Math.PI/180),her[2]-dz*k];};
 for(const t of [[9.9,0,9],[10.7,0,9],[9.9,1,9],[10.7,1,9]]){const o=cam([11.79,-0.01,8.96],t),h=RW.walkRayHit(r,o,[t[0]-o[0],t[1]-o[1],t[2]-o[2]]);
  assert.equal(h.kind,'walk','W tap '+t+' '+JSON.stringify(h));assert.ok(P([11.79,-0.01,8.96],h.at)<8,'W tap path '+t);}
 assert.equal(JSON.stringify(RW.WALK_TAP_SNAP),'["skycity"]');
 const lb=RN.REGION_NODES.skycity.lensBox;assert.ok(lb&&lb[0]>-36&&lb[2]<41&&lb[1]>=-41.5&&lb[3]<=48.5,'skycity lensBox inside the baked floor '+JSON.stringify(lb));
 const OC=load('region/SkycityLensOccluders.ts').SKYCITY_LENS_OCCLUDERS;assert.ok(OC.length>500&&OC.length<3000,'sky occluders '+OC.length);
 assert.ok(OC.some(b=>b[0]<=16&&b[3]>=15&&b[2]<=8&&b[5]>=6&&b[4]>3),'blue-roof house east of S3 has proxies');
 assert.match(src,/if\(this\.region==='skycity'\)return this\.skycityOccluders\(\);/);
 const chk2=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/region-walkable/gen-skycity-lens-occluders.cjs'),'--check'],{encoding:'utf8'});
 assert.equal(chk2.status,0,'sky occluder drift: '+chk2.stderr+chk2.stdout);
 console.log('skycity-walk-r2 ok');}

// b17 skycity-walk-r3 (Mac p0drag7 问题 2): she climbed the decorative tree roots onto the blue-roof house annex (20.84,1.65,7.13)
// and every tap west was 'none'. The roots / annex are not walkable, and the skycity walkable area is ONE component under the
// walkPath rules (8-neighbour, step 0.36·diag, no corner cut, Float32 heights) holding every story node: no "up but not down".
{const r='skycity',g=RW.walkGrid(r),{W,H}=g,id=new Int32Array(W*H).fill(-1);let n=0;
 for(let s=0;s<W*H;s++){if(Number.isNaN(g.h[s])||id[s]>=0)continue;const q=[s];id[s]=n;
  while(q.length){const ci=q.pop(),gx=ci%W,gz=(ci/W)|0;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;const nc=nz*W+nx;
   if(Number.isNaN(g.h[nc])||id[nc]>=0)continue;const d=dx&&dz?Math.SQRT2:1;if(Math.abs(g.h[nc]-g.h[ci])>RW.WALK_STEP_M*d)continue;if(dx&&dz&&(Number.isNaN(g.h[gz*W+nx])||Number.isNaN(g.h[nz*W+gx])))continue;id[nc]=n;q.push(nc);}}
  n++;}
 assert.equal(n,1,'skycity walkable components '+n);
 assert.equal(RW.walkFloorY(r,20.84,7.13),null,'annex top not walkable');
 for(const [x,z] of [[19.6,2.6],[20.4,5.0],[21.2,9.8],[21.6,11.4]])assert.ok(!(RW.walkFloorY(r,x,z)>.3),'roots/annex '+x+','+z);
 const s=RW.nearestWalkable(r,[20.84,1.65,7.13],1.6);assert.ok(s&&s.at[1]<.3,'off the annex she snaps to the ground');
 assert.ok(RW.walkPath(r,s.at,RN.REGION_NODES.skycity.nodes.find(n=>n.key==='S3').at),'and walks back to S3');
 console.log('skycity-walk-r3 components ok');}

// b17 skycity-walk-r3 → r4 (Mac p0drag8): S3 east. The r3 "stop on the near side when it is the long way round" rule stopped her
// 1.5 m short of reachable floor (E3/E6/Root) and is gone: a tap on reachable floor takes her there (≤ 0.3 m). The spot east of the
// low ruin fence (x≈13.5, z 4.5–13.5) is a fenced yard open only to the north, so that walk is a real detour (~14.5–17 m).
// A ray into the blue-roof house still stops at its wall: it now meets the baked voxel field (walls / roots), not the 3 m rule.
{const r='skycity',L=p=>p?RW.walkPathLengthM(p):Infinity,end=p=>p[p.length-1],d2=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
 for(const [f,t] of [[[8.77,0,7.5],[14.5438,0.08,7.1742]],[[8.77,0,7.5],[14.5333,0.08,7.7447]],[[13,0,7.4],[14.6126,0.08,7.7665]],[[11.47,-0.1,7.95],[14.02,0.08,7.53]]]){
  const p=RW.walkTapPath(r,f,t);assert.ok(p&&d2(end(p),t)<=.3,'reaches the tapped floor '+t+' '+(p&&end(p)));assert.ok(L(p)<20,'yard detour bounded '+L(p));}
 assert.equal(L(RW.walkTapPath(r,[6.2,-0.01,8.2],[11.79,-0.01,8.96])).toFixed(3),L(RW.walkPath(r,[6.2,-0.01,8.2],[11.79,-0.01,8.96])).toFixed(3));
 assert.ok(L(RW.walkTapPath(r,[6.2,-0.01,8.2],[11.79,-0.01,8.96]))<8,'near-straight taps untouched');
 const o=[7.12,4.37,7.81],t=[20.84,1.65,7.13],h=RW.walkRayHit(r,o,[t[0]-o[0],t[1]-o[1],t[2]-o[2]],160,.05,[13.82,0.1,7.56]); // the stage passes her position
 assert.equal(h.kind,'walk');assert.ok(h.at[0]<15.5,'E6 tap stops at the house wall '+JSON.stringify(h));
 assert.ok(L(RW.walkTapPath(r,[13.82,0.1,7.56],h.at))<3,'E6 walk short');
 console.log('skycity-walk-r4 S3-east ok');}

// b17 skycity-walk-r4 (Mac p0drag8 P0): hW6 tap (346,581) from her at (11.24,9.6) answered 'none'. Real Mac camera model (orbit:
// pivot = feet + 1.25, fov 48, 390×844): over every pitch / yaw / arm the rays through that pixel never answer 'none' now, and a
// ray from the sky over the plaza that meets nothing still does. Voxel field decodes to its baked cell count.
{const r='skycity',D2R=Math.PI/180,her=[11.24,0.02,9.6];let none=0,n=0;
 // local camera basis (the region's local frame; yaw sweeps all directions so the world rotation does not matter)
 for(const arm of [4,7.48])for(let p=-80;p<=-15;p+=5)for(let y=0;y<360;y+=10){const P=p*D2R,Y=y*D2R,f=[-Math.sin(Y)*Math.cos(P),Math.sin(P),-Math.cos(Y)*Math.cos(P)];
  const c=[her[0]-f[0]*arm,her[1]+1.25-f[1]*arm,her[2]-f[2]*arm],rt=[Math.cos(Y),0,-Math.sin(Y)],up=[-(rt[1]*f[2]-rt[2]*f[1]),-(rt[2]*f[0]-rt[0]*f[2]),-(rt[0]*f[1]-rt[1]*f[0])];
  const t=Math.tan(24*D2R),nx=(2*346/390-1)*t*390/844,ny=(1-2*581/844)*t,d=[0,1,2].map(i=>f[i]+rt[i]*nx+up[i]*ny);
  n++;if(RW.walkRayHit(r,c,d).kind==='none')none++;}
 assert.equal(none,0,'hW6 pixel none '+none+'/'+n);
 assert.equal(RW.walkRayHit(r,[6.2,30,8.2],[0,1,0]).kind,'none','a ray into the sky is still none');
 const D=RW.walkGrid&&require('fs').readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/RegionWalkableData.ts'),'utf8');
 assert.match(D,/skycity:\{[^\n]*obsSlab:0\.25,obsCells:\d+/,'skycity voxel field baked');
 assert.equal((D.match(/obsCells:\d/g)||[]).length,1,'only skycity has the voxel field');
 console.log('skycity-walk-r4 hW6 ok',n);}

// b17 skycity-walk-r4 方案 C (p0drag9): the pocket west of the low fence at (13,7.4) is not walkable (90–130° of the 6 m orbit was
// inside the fence / house there). Taps into it from orbit cameras round her stop her west of it (x ≤ 12.0, ≤ 80° blocked), never 'none'.
{const r='skycity',D2R=Math.PI/180;
 for(const [x,z] of [[13,7.4],[12.6,8.6],[13.2,9.4],[12.2,7.0]])assert.equal(RW.walkFloorY(r,x,z),null,'pocket '+x+','+z);
 let n=0;
 for(const her of [[10.6,0,7.4],[11.8,0,8.2],[9,0,7.5]])for(const tgt of [[13,0,7.4],[12.6,0,8.6],[13.2,0,9.4]])for(const p of [30,45,55])for(let y=0;y<360;y+=45){
  const P=p*D2R,Y=y*D2R,o=[her[0]+6*Math.cos(P)*Math.sin(Y),her[1]+1.25+6*Math.sin(P),her[2]+6*Math.cos(P)*Math.cos(Y)],lk=[her[0]-o[0],her[1]+1.25-o[1],her[2]-o[2]];
  const d=[tgt[0]-o[0],tgt[1]+.05-o[1],tgt[2]-o[2]],c=(d[0]*lk[0]+d[1]*lk[1]+d[2]*lk[2])/Math.hypot(...d)/Math.hypot(...lk);if(c<Math.cos(30*D2R))continue;
  const h=RW.walkRayHit(r,o,d,160,.05,her);assert.equal(h.kind,'walk','pocket tap '+tgt+' '+p+'/'+y);
  const pth=RW.walkTapPath(r,RW.nearestWalkable(r,her,1.6).at,h.at),e=pth[pth.length-1];
  assert.ok(e[0]<=13.05&&!(e[0]>12.05&&e[2]>6.75&&e[2]<10.25),'pocket tap stops outside the pocket '+e+' from '+her+' '+p+'/'+y);n++;}
 console.log('skycity-walk-r4 方案C ok',n);}
