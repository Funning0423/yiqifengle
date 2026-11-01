// rotate lens keys (by index) around the basket by dAz degrees (world yaw), keeping distance + height
const A=require('./audit.cjs');
const from=A.startCamera(0);
function rotKeys(kn,idx,dAz){const keys=kn.keys.map(k=>k.slice());const land=A.landingFor([390,844]);
 for(const [i,da] of idx.map((ii,n)=>[ii,dAz[n]])){const tau=keys[i][0];
  const S0=A.newShot(land,{...kn,keys}),t=tau*S0.F.timing.durationS,P0=S0.F.camera(t,null).position,v=S0.F.vehicle(t);
  const k1=keys.map(k=>k.slice());k1[i][1]+=1;const Pa=A.newShot(land,{...kn,keys:k1}).F.camera(t,null).position;
  const k2=keys.map(k=>k.slice());k2[i][2]+=1;const Ps=A.newShot(land,{...kn,keys:k2}).F.camera(t,null).position;
  const h=[Pa[0]-P0[0],Pa[2]-P0[2]],r=[Ps[0]-P0[0],Ps[2]-P0[2]];
  const d=[P0[0]-v[0],P0[2]-v[2]],a=da*Math.PI/180,nd=[d[0]*Math.cos(a)+d[1]*Math.sin(a),-d[0]*Math.sin(a)+d[1]*Math.cos(a)];
  // atan2(x,z) yaw: rotate so that atan2 increases by da: x'=x cos+z sin, z'=-x sin+z cos
  const D=[nd[0]-d[0],nd[1]-d[1]],det=h[0]*r[1]-h[1]*r[0],da1=(D[0]*r[1]-D[1]*r[0])/det,ds1=(h[0]*D[1]-h[1]*D[0])/det;
  keys[i][1]=+(keys[i][1]+da1).toFixed(2);keys[i][2]=+(keys[i][2]+ds1).toFixed(2);}
 return keys;}
module.exports={rotKeys};
if(require.main===module){const idx=JSON.parse(process.argv[2]),da=JSON.parse(process.argv[3]);console.log(JSON.stringify({keys:rotKeys(A.KN,idx,da)}));}
