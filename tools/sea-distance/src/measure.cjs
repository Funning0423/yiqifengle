'use strict';
// Screen share of far_meadow_impostor on the 7 SAIL_SCREENS (CPU raster at full screen resolution, sea-line clipped: the sea
// plane hides everything under y = SAIL_SEA_Y). Also windmill pixel height (tower+cap+sails, after clip) and the bbox share the
// gate test reports. Usage: node measure.cjs <repo> <impostor_tris.json> [scale]
const path=require('path'),fs=require('fs');
const [REPO,TRIS,SC]=process.argv.slice(2);
const L=require(path.join(REPO,'tools/transitions/sail_farsea_lib.cjs')),leg=L.leg,sea=L.load('region/SeaReveal.ts');
const S=sea.SEA_STANDIN,scale=SC?+SC:S.scale,yaw=S.yawDeg*Math.PI/180,cy=Math.cos(yaw),sy=Math.sin(yaw);
const W=([x,y,z])=>[S.pos[0]+scale*(cy*x+sy*z),S.pos[1]+scale*y,S.pos[2]+scale*(-sy*x+cy*z)];
const tris=JSON.parse(fs.readFileSync(TRIS,'utf8')).map(t=>({tag:t.tag,v:t.v.map(W)}));
const route=leg.sailRoute(),tl=leg.sailBeats(route.length),st=leg.sailStillTimes(tl);
const lens=(t,s)=>t>=11.4&&t<=18.0?sea.seaLateralPose(leg.sailVehicle(tl,route.samples,t).pos):leg.sailCamera(tl,route.samples,t,s);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],nrm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
function clipY(poly,y0){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=a[1]>=y0,ib=b[1]>=y0;if(ia)out.push(a);if(ia!==ib){const t=(y0-a[1])/(b[1]-a[1]);out.push([a[0]+t*(b[0]-a[0]),y0,a[2]+t*(b[2]-a[2])]);}}return out;}
function measure(cam,scr){
 const w=scr.w,h=scr.h,f=nrm(sub(cam.target,cam.position)),r=nrm(cross(f,[0,1,0])),u=cross(r,f),ty=Math.tan(cam.fovVerticalDeg*Math.PI/360),tx=ty*w/h;
 const P=p=>{const d=sub(p,cam.position),z=dot(d,f);return [(dot(d,r)/(z*tx)*0.5+0.5)*w,(0.5-dot(d,u)/(z*ty)*0.5)*h,z];};
 const buf=new Uint8Array(w*h);let millTop=Infinity,millBot=-Infinity,dist=0,n=0;
 for(const t of tris){const poly=clipY(t.v,leg.SAIL_SEA_Y??-0.91);if(poly.length<3)continue;const q=poly.map(P);if(q.some(p=>p[2]<0.3))continue;
  const mill=t.tag!=='terrain'&&t.tag!=='tree';
  for(let k=1;k<q.length-1;k++){const a=q[0],b=q[k],c=q[k+1];
   const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],c[1])));
   const e=(p,q2,x,y)=>(q2[0]-p[0])*(y-p[1])-(q2[1]-p[1])*(x-p[0]),A=e(a,b,c[0],c[1]);if(Math.abs(A)<1e-9)continue;
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5,py=y+.5,w0=e(b,c,px,py)/A,w1=e(c,a,px,py)/A,w2=e(a,b,px,py)/A;if(w0>=0&&w1>=0&&w2>=0)buf[y*w+x]|=mill?2:1;}}
  if(mill)for(const p of q){if(p[0]>=0&&p[0]<=w){millTop=Math.min(millTop,p[1]);millBot=Math.max(millBot,p[1]);}dist+=p[2];n++;}}
 let cov=0,mill=0,ymin=h,ymax=-1;for(let i=0;i<buf.length;i++)if(buf[i]){cov++;if(buf[i]&2)mill++;const y=(i/w)|0;ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}
 return {areaPct:+(cov/(w*h)*100).toFixed(3),heightPct:+((ymax>=ymin?ymax-ymin+1:0)/h*100).toFixed(2),islandPx:ymax>=ymin?ymax-ymin+1:0,millPxH:Number.isFinite(millTop)?+(millBot-millTop).toFixed(1):0,millPxArea:mill,distM:n?+(dist/n).toFixed(0):0};}
const times={dock:0,k2:st.k2,preSwap:11.3};
const out=[];for(const s of leg.SAIL_SCREENS){const row={screen:s.w+'x'+s.h};for(const [k,t] of Object.entries(times))row[k]=measure(lens(t,s),s);out.push(row);}
console.log(JSON.stringify({scale,times,rows:out},null,0));
