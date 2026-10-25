// T-02 finale → seg 5a walk handoff (SkyWalkShot): 7 screens; her + city in frame, caps via TransitionRun, occluders, no cut.
const assert=require('assert'),fs=require('fs'),path=require('path');const {createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),S=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),TC=H.load('region/TransitionCamera.ts'),HS=H.load('region/HerShot.ts');
const M=TS.TRANSITION_STAGING.skyMooring5a,occ=JSON.parse(fs.readFileSync(path.join(__dirname,'transition-occluders.json'),'utf8'));
const boxes=Object.values(occ.boxes).flatMap(v=>Array.isArray(v)?v:[v.open100]);// door leaves open on her arrival
// skycity root from the mooring's two frames (world = root ∘ local) → city centre, 6 m up
const ry=(M.worldYawDeg-M.yawDeg)*Math.PI/180,l=M.pos,c=Math.cos(ry),s=Math.sin(ry);
const root=[M.world[0]-(c*l[0]+s*l[2]),M.world[1]-l[1],M.world[2]-(-s*l[0]+c*l[2])],city=[root[0],root[1]+6,root[2]];
const SCREENS=[[390,844],[375,667],[414,896],[360,780],[430,932],[768,1024],[844,390]];
const proj=(p,q,fov,asp)=>{const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],n=Math.hypot(...f);f.forEach((v,i)=>f[i]=v/n);
 const r=[f[2],0,-f[0]],rn=Math.hypot(r[0],r[2]);r[0]/=rn;r[2]/=rn;const u=[f[1]*r[2]-f[2]*r[1],f[2]*r[0]-f[0]*r[2],f[0]*r[1]-f[1]*r[0]];
 const d=[q[0]-p.position[0],q[1]-p.position[1],q[2]-p.position[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(z<=0)return null;
 const th=Math.tan(fov*Math.PI/360);return [-(d[0]*r[0]+d[2]*r[2])/z/(th*asp),(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/z/th];};
// T-02 finale (SkyFinaleShot.SKY_FINALE_POSE_LOCAL, skycity-local) → world via the skycity root = start pose of the gaze + walk
function FROM(){return from;}
const FS=H.load('region/SkyFinaleShot.ts'),W2=q=>[root[0]+c*q[0]+s*q[2],root[1]+q[1],root[2]-s*q[0]+c*q[2]],FL=FS.SKY_FINALE_POSE_LOCAL;
const from={position:W2(FL.position),target:W2(FL.target),fovVerticalDeg:FL.fovVerticalDeg};
// the city she gazes at = 60 m down the finale lens axis (what the finale frames), replacing the skycity root
{const d=from.target.map((v,i)=>v-from.position[i]),n=Math.hypot(...d);for(let i=0;i<3;i++)city[i]=from.position[i]+d[i]/n*60;}
const gazeS=2/* the 2 s gaze after the finale */,W=S.skyWalkShot(M.walkWorld,M.walkMps,gazeS,boxes,city,undefined,from);global.__W=W;
const rows=[];
for(const [w,h] of SCREENS){const asp=w/h,run=TC.beginTransitionSpec({id:'T02-walk',keys:[],source:W.pose,mode:t=>t<gazeS?'stand':'walk',seconds:W.total},{pose:from});
 let prev=null,yawMax=0,stepMax=0,herMin=9,cityIn=0,n=0,occS=0,occMax=0,clrMin=9,yawPrev=null,accs=[];const dt=1/60;
 for(let t=0;t<=W.total;t+=dt){const p=run.step(dt),her=W.her(t),chest=[her.feet[0],her.feet[1]+1.2,her.feet[2]],face=[her.feet[0],her.feet[1]+1.5,her.feet[2]];
  const yaw=Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*180/Math.PI;
  if(prev){stepMax=Math.max(stepMax,Math.hypot(...p.position.map((v,i)=>v-prev.position[i])));let dy=((yaw-prev.yaw+540)%360)-180;const yr=Math.abs(dy)/dt;yawMax=Math.max(yawMax,yr);if(yawPrev!=null)accs.push(Math.abs(dy/dt-yawPrev)/dt);yawPrev=dy/dt;}
  prev={position:p.position,yaw};const ef=Math.min(p.fovVerticalDeg,p.fovVerticalDeg);
  for(const q of [chest,face]){const v=proj(p,q,p.fovVerticalDeg,asp);if(process.env.DBG&&w===390&&Math.abs(t%1)<dt)console.log('D',t.toFixed(1),v&&v.map(x=>x.toFixed(2)),proj(p,city,p.fovVerticalDeg,asp)?.map(x=>x.toFixed(2)));herMin=Math.min(herMin,v?1-Math.max(Math.abs(v[0]),Math.abs(v[1])):-1);}
  const cv=proj(p,city,p.fovVerticalDeg,asp);n++;if(cv&&Math.abs(cv[0])<1&&Math.abs(cv[1])<1)cityIn++;
  const hid=boxes.some(b=>HS.segBox(p.position,face,b)||HS.segBox(p.position,chest,b));occS=hid?occS+dt:0;occMax=Math.max(occMax,occS);
  for(const b of boxes){assert(!HS.inBox(p.position,b),'lens in box');clrMin=Math.min(clrMin,HS.boxDist(p.position,b));}}
 accs.sort((a,b)=>a-b);const r={screen:`${w}x${h}`,gazeS,walkS:+W.walkS.toFixed(2),total:+W.total.toFixed(2),yawMax:+yawMax.toFixed(1),yawAccP99:Math.round(accs[Math.floor(accs.length*.99)]),stepMaxM:+stepMax.toFixed(3),herMarginMin:+herMin.toFixed(3),cityInFrac:+(cityIn/n).toFixed(3),occFaceChestMaxS:+occMax.toFixed(2),clearMinM:+clrMin.toFixed(2)};rows.push(r);
 assert(r.yawMax<=120.5&&r.yawAccP99<=300,'yaw caps '+JSON.stringify(r));assert(r.stepMaxM<=.6,'no cut '+JSON.stringify(r));assert(r.herMarginMin>0,'her in frame '+JSON.stringify(r));
 assert(r.occFaceChestMaxS<=.5,'occlusion '+JSON.stringify(r));assert(r.cityInFrac>=.8,'city in frame '+JSON.stringify(r));}
console.log(JSON.stringify({test:'sky-walk-shot',status:'PASS',city:city.map(v=>+v.toFixed(2)),rows}));
