'use strict';
// b19 seg5 option C: moorings ≥ Rmin from S6 on walkable floor, parked gap ≥ 0.5 and ≥1 lift direction keeping ≥ 0.5 along the
// T-03 lift shape (lakesideBalloonFlight 0–18 s, shown in ~5 s). Prints candidates sorted by walk seconds (RegionWalkable.walkPath).
const C=require('./check-lift-clearance.cjs');const {load}=require('../region-nodes/load.cjs');const RW=load('region/RegionWalkable.ts');
const E=require('./eval-5a-moorings.cjs');/* T-03 lift shape (skycity-local offsets from launch), 0.25 s steps over 18 s flight time */
const S6=E.S6,BOX='-45,-70,45,15',RMIN=+(process.argv[2]||11),RMAX=+(process.argv[3]||30),STEP=+(process.argv[4]||1);
const shape=E.traj.filter((_,i)=>i%4===0);/* 1 s flight-time keys, 19 keys */
const lift=(root,dir)=>shape.map((o,i)=>{const hz=Math.hypot(o[0],o[2]),q=E.rot(dir,[0,0,hz]);return {t:+(i*5/18).toFixed(3),pos:[root[0]+q[0],root[1]+o[1],root[2]+q[2]]};});
const out=[],N={all:0,floor:0,flat:0,park:0,lift:0},PK=[];
for(let x=S6[0]-RMAX;x<=S6[0]+RMAX;x+=STEP)for(let z=S6[2]-RMAX;z<=S6[2]+RMAX;z+=STEP){const d=Math.hypot(x-S6[0],z-S6[2]);if(d<RMIN||d>RMAX)continue;N.all++;
 const g=RW.walkFloorY('skycity',x,z);if(g==null)continue;N.floor++;let flat=true;for(let a=0;a<6.28;a+=.785){const h=RW.walkFloorY('skycity',x+.9*Math.cos(a),z+.9*Math.sin(a));if(h==null||Math.abs(h-g)>.06){flat=false;break;}}if(!flat)continue;N.flat++;
 const root=[x,g+.03,z];const park=C.check({keys:[{t:0,pos:root}]},{dt:1,box:BOX});PK.push([park.minGapM,x,z]);if(park.minGapM<.5)continue;N.park++;
 let best=null;for(let dir=0;dir<360;dir+=30){const r=C.check({keys:lift(root,dir)},{dt:.1,box:BOX});if(!best||r.minGapM>best.minGapM)best={...r,dir};}
 if(best.minGapM<.5){PK[PK.length-1].push('lift',best.dir,best.minGapM,best.atT,best.hit);continue;}N.lift++;const wp=RW.walkPath?RW.walkPath('skycity',S6,root):null;let L=null;if(wp&&wp.length){L=0;for(let i=1;i<wp.length;i++)L+=Math.hypot(wp[i][0]-wp[i-1][0],wp[i][2]-wp[i-1][2]);}
 out.push({root:root.map(v=>+v.toFixed(3)),straightM:+d.toFixed(2),walkM:L&&+L.toFixed(2),walkS:L&&+(L/1.2+.6).toFixed(2),parkGap:park.minGapM,parkHit:park.hit,liftDir:best.dir,liftGap:best.minGapM,liftAtT:best.atT,liftHit:best.hit});}
console.error(JSON.stringify(N));PK.sort((a,b)=>b[0]-a[0]);console.error(JSON.stringify(PK.slice(0,12)));out.sort((a,b)=>(a.walkS??1e9)-(b.walkS??1e9));console.log(JSON.stringify(out.slice(0,15),null,0).replace(/\},\{/g,'},\n{'));
