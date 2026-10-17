// node evalf.cjs <wt> <frames.json> <out.csv> [palmVariant: cur|CA2] [tC]
const path=require('path'),fs=require('fs');const wt=process.argv[2];
const G=require(path.join(wt,'tools/camera-frame-test/glb_geometry.cjs')),T9=require(path.join(wt,'tools/camera-frame-test/t9_props.cjs'));
const variant=process.argv[5]||'cur',tC=+(process.argv[6]||0);
if(variant==='CA2'){T9.PROPS[0]={prefab:'ui_signpost',position:[-4.05,0.1295,1.1],yawDeg:-2,scale:0.85};T9.PROPS[1]={prefab:'beach_palm_tall',position:[2.0,0.04,6.6],yawDeg:180,scale:0.65};}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],nrm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)},crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
(async()=>{const base=await G.decode(),geo=await T9.merged(base),I=G.index(geo);
 const F=JSON.parse(fs.readFileSync(process.argv[3])).frames;const rows=[];let prev=null;
 const ndc=(p,fw,fov,asp,X)=>{const f=nrm(fw),r=nrm(crs(f,[0,1,0])),u=crs(r,f),d=sub(X,p),z=dot(d,f),th=Math.tan(fov*Math.PI/360);return [dot(d,r)/z/(th*asp),dot(d,u)/z/th,z];};
 for(const f of F){const p=f.pos,r=f.root,c=I.clearance(p,1.5);
  const occ=[['face',1.55],['head',1.7253],['chest',1.0],['feet',0.1]].map(([n,h])=>I.occluded(p,[r[0],r[1]+h,r[2]])||'');
  let cross='';if(prev){const d=sub(p,prev),L=Math.hypot(...d);if(L>1e-6){const e=d.map(v=>v/L*0.051);cross=I.occluded(prev,[p[0]+e[0],p[1]+e[1],p[2]+e[2]])||'';}}
  const hs=Math.hypot(p[0]-r[0],p[2]-r[2]);const yaw=f.yaw,fx=Math.sin(yaw),fz=Math.cos(yaw),rx=-fz,rz=fx; // her right
  const side=((p[0]-r[0])*rx+(p[2]-r[2])*rz);
  const out={t:f.t,b5:f.t>=tC-1e-9?1:0,cx:p[0],cy:p[1],cz:p[2],rx:r[0],rz:r[2],horizDist:hs,rightOffset:side,clear:c.d,clearMesh:c.who||'',occFace:occ[0],occHead:occ[1],occChest:occ[2],occFeet:occ[3],segCross:cross,fov:f.fov,door:f.door};
  for(const a of [0.46,0.75]){const ft=ndc(p,f.fwd,f.fov,a,[r[0],r[1]+0.0,r[2]]),hd=ndc(p,f.fwd,f.fov,a,[r[0],r[1]+1.7253,r[2]]);out['feetNdcY_'+a]=ft[1];out['headNdcY_'+a]=hd[1];out['feetNdcX_'+a]=ft[0];}
  rows.push(out);prev=p;}
 const K=Object.keys(rows[0]);fs.writeFileSync(process.argv[4],K.join(',')+'\n'+rows.map(o=>K.map(k=>typeof o[k]==='number'?+o[k].toFixed(4):o[k]).join(',')).join('\n')+'\n');
 const S=rows.filter(o=>o.b5),mn=(k,R=S)=>R.reduce((m,o)=>o[k]<m[k]?o:m);
 const sum={variant,frames:rows.length,b5Frames:S.length,minClear:{d:mn('clear').clear,mesh:mn('clear').clearMesh,t:mn('clear').t},minClearAll:{d:mn('clear',rows).clear,mesh:mn('clear',rows).clearMesh,t:mn('clear',rows).t},
  occlFrames:S.filter(o=>o.occFace||o.occHead||o.occChest).length,occlFeet:S.filter(o=>o.occFeet).length,crossings:rows.filter(o=>o.segCross).map(o=>[o.t,o.segCross]).slice(0,5),crossCount:rows.filter(o=>o.segCross).length,
  leftFrames:S.filter(o=>o.rightOffset<0&&o.horizDist>0.05).length,minHoriz:mn('horizDist').horizDist,minFeetNdc046:mn('feetNdcY_0.46').feetNdcY_0_46??mn('feetNdcY_0.46')['feetNdcY_0.46'],minFeetNdc075:mn('feetNdcY_0.75')['feetNdcY_0.75'],
  minFeetT:mn('feetNdcY_0.46').t};
 console.log(JSON.stringify(sum));})();
