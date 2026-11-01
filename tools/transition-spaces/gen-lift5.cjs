'use strict';
// b19 seg5: suggested lift-off for the option-C mooring (reference for 运镜bot, not final): T-03 lift shape
// (lakesideBalloonFlight flight time 0–18 s: +13.5 m up, ~25 m out) turned to the clear direction and shown in 5 s.
// Writes lift5-suggested.json {frame:'skycity',keys:[{t,pos,yaw}]} and prints the check-lift-clearance result.
const fs=require('fs'),E=require('./eval-5a-moorings.cjs'),C=require('./check-lift-clearance.cjs');
const S=JSON.parse(fs.readFileSync(__dirname+'/stances.json','utf8')).segments['5a_skycity_balloon_in'].balloon;
const root=S.root,dir=S.liftDirDeg,yaw=S.yawDeg;
const keys=[];for(let k=0;k<=20;k++){const o=E.traj[Math.min(E.traj.length-1,Math.round(k*0.9/0.25))],hz=Math.hypot(o[0],o[2]),q=E.rot(dir,[0,0,hz]);keys.push({t:+(k*0.25).toFixed(2),pos:[root[0]+q[0],root[1]+o[1],root[2]+q[2]].map(v=>+v.toFixed(3)),yaw});}
const doc={frame:'skycity',note:'T-03 lift shape (flight 0–18 s) rotated to '+dir+'°, shown in 5 s; basket yaw held (运镜bot may turn it toward the lake heading after t≈2 s)',keys};
fs.writeFileSync(__dirname+'/lift5-suggested.json',JSON.stringify(doc,null,1));
const r=C.check(doc,{dt:0.02,min:0.5});console.log(JSON.stringify({minGapM:r.minGapM,atT:r.atT,atPos:r.atPos,hit:r.hit,hitPoint:r.hitPoint,perKey:r.perKey}));
