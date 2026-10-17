/** 彩虹桥 deck mesh — DRAFT for GGbot (场景设计部 2026-10-17). Pure maths + utils.createMesh, mirrors scripts/rb.py section()/build_bridge().
 *  Replaces the 7 flat RainbowBridgeStrip* ribbons (7 DC, builtin-standard, hard square ends) with ONE closed, thick, arched deck:
 *  walk surface (9 verts, 3 cm crown) + two 7.5 cm rim curbs + chamfered sides + slightly concave underside = 20 verts per ring.
 *  Stations every 0.5 m on the span and 0.2 m inside the 2.8 m end zones (24 m bridge -> 66 rings, 1320 verts, 2600 tris; same as the Blender sample).
 *  End zones: thickness 0.24 -> 0.012 m, width flares +0.22 m per side, curbs melt down, a_color.b (fade) 1 -> 0; the deck rides
 *  >= 1.2 cm above the anchor level so it never enters the ground. The effect dissolves the faded part into petal-shaped cells.
 *  Coordinates: Cocos world, Y up. Node stays at identity (same as today's strips). */
import {utils, Mesh} from 'cc';
type Vec=[number,number,number];
export const RB={width:2.1,endM:2.8,thickM:0.24,tipThickM:0.012,flareM:0.22,curbM:0.075,curbW:0.11,crownM:0.03,tipLiftM:0.03,spanStepM:0.5,endStepM:0.2,topVerts:9};
const ss=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t);};
/** Arch profile. Today: sin(pi t). Recommended: sin^2(pi t) — same 2 m peak, but the deck meets each landing tangentially
 *  (slope 0 instead of 15°), so it lays down on the ground instead of plunging into it. Must match bridgePath() (walk path). */
export const archSin2=(t:number)=>Math.sin(Math.PI*t)**2;
export const archSin=(t:number)=>Math.sin(Math.PI*t);
export function bridgePoint(a:Vec,b:Vec,arch:number,f:(t:number)=>number,t:number):Vec{return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+f(t)*arch,a[2]+(b[2]-a[2])*t];}
function section(d:number){ // d = metres to the nearest tip
 const k=ss(0,RB.endM,d),th=Math.max(RB.tipThickM,RB.thickM*ss(0.3,RB.endM+0.6,d)),w=RB.width/2+RB.flareM*(1-k),curb=RB.curbM*ss(0.8,RB.endM,d),cw=RB.curbW,crown=RB.crownM*k;
 const ring:Array<[number,number,number,number,number]>=[]; // [lateral, normal-offset, uvx, part, shade]
 for(let i=0;i<RB.topVerts;i++){const u=-1+2*i/(RB.topVerts-1);ring.push([(w-cw)*u,crown*(1-u*u),i/(RB.topVerts-1),0,1]);}
 ring.push([w-cw*.6,curb,1,.33,1.15],[w,curb*.85,1,.33,1.1],[w+.03,-th*.15,0,.66,.92],[w-.02,-th*.75,1,.66,.8],[w*.55,-th,.2,1,.68],[0,-th*.96,.5,1,.66],
  [-w*.55,-th,.8,1,.68],[-w+.02,-th*.75,1,.66,.8],[-w-.03,-th*.15,0,.66,.92],[-w,curb*.85,0,.33,1.1],[-w+cw*.6,curb,0,.33,1.15]);
 return {ring,th};
}
export function rainbowBridgeMesh(a:Vec,b:Vec,arch:number,f:(t:number)=>number=archSin2):Mesh{
 const plan=Math.hypot(b[0]-a[0],b[2]-a[2]);const stations:number[]=[];
 for(let s=0;s<plan-1e-6;){stations.push(s);s+=Math.min(s,plan-s)<RB.endM+.2?RB.endStepM:RB.spanStepM;}stations.push(plan);
 const dx=(b[0]-a[0])/plan,dz=(b[2]-a[2])/plan,X:Vec=[dz,0,-dx]; // same lateral as today's strips (band 0 = side -0.5)
 const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];let arc=0,prev:Vec|null=null;let n=0;
 for(const s of stations){
  const t=s/plan,p=bridgePoint(a,b,arch,f,t),q=bridgePoint(a,b,arch,f,Math.min(1,t+.002)),r=bridgePoint(a,b,arch,f,Math.max(0,t-.002));
  const T=[q[0]-r[0],q[1]-r[1],q[2]-r[2]],tl=Math.hypot(T[0],T[1],T[2])||1;T[0]/=tl;T[1]/=tl;T[2]/=tl;
  let N:Vec=[T[1]*X[2]-T[2]*X[1],T[2]*X[0]-T[0]*X[2],T[0]*X[1]-T[1]*X[0]];if(N[1]<0)N=[-N[0],-N[1],-N[2]];
  if(prev)arc+=Math.hypot(p[0]-prev[0],p[1]-prev[1],p[2]-prev[2]);prev=p;
  const d=Math.min(s,plan-s),{ring,th}=section(d),fade=ss(0,RB.endM,d);
  // end ride: never below the anchor level (+1.2 cm under the deck); the GLB end caps carry the ground halo and petals
  const endY=s<plan/2?a[1]:b[1];let lift=RB.tipLiftM*(1-ss(.6,RB.endM,d));const need=endY+.012+th-(p[1]+lift);if(need>0&&d<RB.endM+1)lift+=need;
  for(const [x,z,uvx,part,shade] of ring){
   positions.push(p[0]+X[0]*x+N[0]*z,p[1]+lift+X[1]*x+N[1]*z,p[2]+X[2]*x+N[2]*z);uvs.push(uvx,arc);colors.push(part,shade,fade,1);
  }
  n=ring.length;
 }
 for(let i=0;i+1<stations.length;i++)for(let j=0;j<n;j++){const a0=i*n+j,a1=i*n+(j+1)%n,b0=a0+n,b1=a1+n;indices.push(a0,b0,a1,a1,b0,b1);} // check winding vs cullMode back on first run
 return utils.createMesh({positions,uvs,colors,indices},undefined,{calculateBounds:true});
}
