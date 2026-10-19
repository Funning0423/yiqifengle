// r7 static framing scan: fresh orbit goal (at rest) over yaw × pitch × arm; her seated body edge on the 390×844 safe frame.
//   node scan_room_frame.cjs [distMin]   → JSON {fails:[...], worst per yaw}
const fs=require('node:fs'),path=require('node:path'),{load}=require('./load.cjs');
const C=load('region/FreeOrbit.ts'),R=load('world-r1/CharacterReference.ts');
const FX=path.join(__dirname,'fixtures/room-keepinside'),J=f=>JSON.parse(fs.readFileSync(path.join(FX,f),'utf8'));
const HER=J('her_seated_points.json').points,WORLD=J('world_boxes.json').boxes,L=C.ORBIT_LIMITS.home,seat=R.CHARACTER_REFERENCE.seatedRoot,feet=[seat[0],seat[1],seat[2]];
const ASPECT=390/844,TV=Math.tan(30*Math.PI/180),TH=TV*ASPECT,SAFE=0.9,W_ORBIT=0.1;
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function edge(p,t){const d0=[t[0]-p[0],t[1]-p[1],t[2]-p[2]],n0=Math.hypot(...d0),f=d0.map(v=>v/n0),r0=cross(f,[0,1,0]),n=Math.hypot(...r0),r=r0.map(v=>v/n),u=cross(r,f);let e=0,cx=0,cy=0,k=0;
 for(const q of HER){const d=[q[0]-p[0],q[1]-p[1],q[2]-p[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(z<=0.05)return {e:9};const x=(d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/z/TH,y=(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/z/TV;e=Math.max(e,Math.abs(x),Math.abs(y));cx+=x;cy+=y;k++}
 return {e,cx:cx/k,cy:cy/k}}
const dmin=+(process.argv[2]||L.distMin),res={distMin:dmin,fails:[],perYaw:{}};
const YS=+(process.env.SCAN_YAW||5),PS=+(process.env.SCAN_PITCH||4),DN=+(process.env.SCAN_DN||6);
for(let yaw=0;yaw<360;yaw+=YS)for(let pitch=L.pitchMinDeg;pitch<=L.pitchMaxDeg+1e-9;pitch+=PS)for(let dist=dmin;dist<=L.distMax+1e-9;dist+=(L.distMax-dmin)/DN){
 const o=new C.FreeOrbit('home');o.yaw=yaw;o.pitch=pitch;o.dist=dist;const p=o.solve(feet,WORLD,seat[1]);if(o.roomWeight>W_ORBIT)continue;const h=edge(p.position,p.target);
 const k=String(yaw);if(!res.perYaw[k]||res.perYaw[k].e<h.e)res.perYaw[k]={e:+h.e.toFixed(3),pitch,dist:+dist.toFixed(2),cx:h.cx&&+h.cx.toFixed(2),cy:h.cy&&+h.cy.toFixed(2)};
 if(h.e>SAFE)res.fails.push([yaw,pitch,+dist.toFixed(2),+h.e.toFixed(3)])}
console.log(JSON.stringify(res));
