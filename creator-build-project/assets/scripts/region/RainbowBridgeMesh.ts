/** 彩虹桥 r5 (GGbot, from 场景设计部's approved plan 2026-10-17, product/2026-10-17/rainbow-bridge/IMPLEMENTATION.md).
 *  Pure geometry + look numbers, no 'cc' import (tests run it in node; RainbowBridge.ts turns it into meshes/materials).
 *  - Deck: ONE closed, thick, arched mesh (walk surface with a 3 cm crown, two 7.5 cm rim curbs, chamfered sides, slightly
 *    concave underside; 20 verts per ring) that follows the controller centreline exactly (the polyline she walks). End zones:
 *    thickness 0.24 → 0.012 m, width flares +0.22 m a side, curbs melt down, a_color.b (fade) 1 → 0 for the petal dissolve.
 *    The deck rides ≥ 1.2 cm above the REAL ground under it (RainbowBridgeGround tables, baked from the region GLBs); an end
 *    may push a short "tongue" back onto land (island: the path ends at the cliff edge).
 *  - Ground (per capped end): 8×6-quad colour halo draped on the ground 2.5 cm up, 34 petals, 8 small rainbow flowers (grass only,
 *    never on the path, the deck or her walk).
 *  - Motes: 20 glow dots + 12 falling petals per capped end + 24 curb sparkles = 88 GPU-animated quads (no ParticleSystem: the
 *    particle engine module is off in this project and would cost far more than the 35 KB budget).
 *  Coordinates: Cocos world, Y up; nodes stay at identity (like the old RainbowBridgeStrip*). */
export type Vec=readonly [number,number,number];
export type GroundFn=(x:number,z:number)=>number|null;
/** 'g' grass, 'p' path, 's' other walkable (sand/rock/bank), '' nothing there. */
export type SurfaceFn=(x:number,z:number)=>string;
export interface RainbowEnd{
 /** ground height under (x,z) or null (water / off the model); without it the end rides its anchor level (draft rule). */
 ground?:GroundFn|null;surface?:SurfaceFn|null;
 /** metres the deck continues past the path end, lying on the ground (default 0). */
 tongueM?:number;
 /** halo + petals + flowers + this end's motes (default true when ground is known). */
 cap?:boolean;
 /** her walk next to this end (approach/arrival points): no flowers within 0.6 m of it. */
 avoid?:readonly Vec[];
}
export interface RainbowGeometry{positions:number[];normals:number[];uvs:number[];colors:number[];indices:number[];
 minPos:{x:number;y:number;z:number};maxPos:{x:number;y:number;z:number};}
export const RB={width:2.1,endM:2.8,thickM:0.24,tipThickM:0.012,flareM:0.22,curbM:0.075,curbW:0.11,crownM:0.03,tipLiftM:0.03,
 spanStepM:0.5,endStepM:0.2,topVerts:9,ringVerts:20,
 /** walk surface centre this far below her feet (the old strips sat 1.5 cm below) */
 feetM:0.01,clearM:0.012,haloLiftM:0.025,petalLiftM:0.012} as const;
/** Particle budget (hard cap 88, 场景设计部 §3.2). */
export const RAINBOW_PARTICLES={glowPerEnd:20,petalsPerEnd:12,curb:24,max:88} as const;
/** Look numbers. `concept` = 场景设计部's draft (rbParams0 day [1,.88,.32,0], night x1.25): rejected by the lead as too opaque /
 *  too saturated ("rainbow slide"), so the shipped deck is clearly lighter and paler, the 1.2 m white light seams are gone and the
 *  night deck is DIMMER than the day one (no glow-out). Deck: [emit, alpha, saturation, night]; ends: [halo, motes, ground petals, night]. */
export const RAINBOW_LOOK={
 concept:{emit:1,alpha:.88,saturation:1,seam:.32,nightEmit:1.25},
 day:{emit:1,alpha:.5,saturation:.58,halo:.22,motes:.75,ground:1},
 night:{emit:.78,alpha:.46,saturation:.58,halo:.4,motes:.9,ground:.62},
 /** streak (UV scroll) and sparkle grains stay faint; there is NO seam term in the effect any more. */
 flow:{speedMps:.6,periodM:7,streak:.1,sparkle:.3},
} as const;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export function rainbowLook(night:number):{deck:[number,number,number,number];ends:[number,number,number,number]}{
 const w=Math.max(0,Math.min(1,Number.isFinite(night)?night:0)),D=RAINBOW_LOOK.day,N=RAINBOW_LOOK.night;
 return {deck:[lerp(D.emit,N.emit,w),lerp(D.alpha,N.alpha,w),lerp(D.saturation,N.saturation,w),w],ends:[lerp(D.halo,N.halo,w),lerp(D.motes,N.motes,w),lerp(D.ground,N.ground,w),w]};
}
/** The 7 band colours (sRGB) — the same table as rainbow-bridge.effect band(). */
export const RAINBOW_BANDS:ReadonlyArray<Vec>=[[.95,.30,.38],[1,.56,.22],[1,.84,.30],[.42,.84,.45],[.26,.78,.90],[.38,.52,.98],[.70,.42,.92]];
const ss=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t);};
export function bandColor(u:number):Vec{const x=Math.max(0,Math.min(1,u))*6,i=Math.min(5,Math.floor(x));let f=x-i;f=f*f*(3-2*f);const a=RAINBOW_BANDS[i],b=RAINBOW_BANDS[i+1];return [lerp(a[0],b[0],f),lerp(a[1],b[1],f),lerp(a[2],b[2],f)];}
/** Pale version for ground petals / flowers / halo (same desaturation as the deck). */
export function paleBand(u:number,sat:number=RAINBOW_LOOK.day.saturation):Vec{const c=bandColor(u),l=.299*c[0]+.587*c[1]+.114*c[2];const f=(v:number)=>lerp(lerp(l,v,sat),1,.18);return [f(c[0]),f(c[1]),f(c[2])];}
/** Plan (xz) polyline sampler over the controller path, extended straight (level) past both ends for tongues. */
export function pathSampler(path:readonly Vec[]){
 if(path.length<2)throw Error('rainbow-bridge-path');
 const cum=[0];for(let i=1;i<path.length;i++)cum.push(cum[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][2]-path[i-1][2]));
 const plan=cum[cum.length-1];if(!(plan>1))throw Error('rainbow-bridge-path-short');
 const dir=(i:number,j:number)=>{const dx=path[j][0]-path[i][0],dz=path[j][2]-path[i][2],l=Math.hypot(dx,dz)||1;return [dx/l,dz/l];};
 const d0=dir(0,1),d1=dir(path.length-2,path.length-1);
 const at=(s:number):Vec=>{
  if(s<=0)return [path[0][0]+d0[0]*s,path[0][1],path[0][2]+d0[1]*s];
  if(s>=plan){const e=path[path.length-1],k=s-plan;return [e[0]+d1[0]*k,e[1],e[2]+d1[1]*k];}
  let lo=0,hi=cum.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(cum[m]<=s)lo=m;else hi=m;}
  const t=(s-cum[lo])/((cum[hi]-cum[lo])||1),a=path[lo],b=path[hi];return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];};
 return {plan,at,startDir:d0,endDir:d1};
}
function section(d:number){ // d = metres to the nearest tip (of the deck incl. tongue)
 const k=ss(0,RB.endM,d),th=Math.max(RB.tipThickM,RB.thickM*ss(0.3,RB.endM+0.6,d)),w=RB.width/2+RB.flareM*(1-k),curb=RB.curbM*ss(0.8,RB.endM,d),cw=RB.curbW,crown=RB.crownM*k;
 // walk-surface centre RB.feetM under her feet, crowned: the top edges sit `crown` lower; T = top-edge level
 const T=-RB.feetM-crown;
 // [lateral, normal offset, uvx, part, shade]
 const ring:Array<[number,number,number,number,number]>=[];
 for(let i=0;i<RB.topVerts;i++){const u=-1+2*i/(RB.topVerts-1);ring.push([(w-cw)*u,-RB.feetM-crown*u*u,i/(RB.topVerts-1),0,1]);}
 ring.push([w-cw*.6,T+curb,1,.33,1.15],[w,T+curb*.85,1,.33,1.1],[w+.03,T-th*.15,0,.66,.92],[w-.02,T-th*.75,1,.66,.8],[w*.55,T-th,.2,1,.68],[0,T-th*.96,.5,1,.66],
  [-w*.55,T-th,.8,1,.68],[-w+.02,T-th*.75,1,.66,.8],[-w-.03,T-th*.15,0,.66,.92],[-w,T+curb*.85,0,.33,1.1],[-w+cw*.6,T+curb,0,.33,1.15]);
 return {ring,th,w,bottom:T-th};
}
const bounds=(p:number[],grow:[number,number,number,number]=[0,0,0,0])=>{const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<p.length;i++){const c=i%3;if(p[i]<mn[c])mn[c]=p[i];if(p[i]>mx[c])mx[c]=p[i];}
 return {minPos:{x:mn[0]-grow[0],y:mn[1]-grow[3],z:mn[2]-grow[0]},maxPos:{x:mx[0]+grow[0],y:mx[1]+grow[1],z:mx[2]+grow[0]}};};
/** The deck. ends[0] = path start, ends[1] = path end. */
export function rainbowDeckGeometry(path:readonly Vec[],ends:readonly [RainbowEnd|null,RainbowEnd|null]=[null,null]):RainbowGeometry&{rings:number;stations:number[];top:(s:number)=>number}{
 const P=pathSampler(path),t0=-Math.max(0,ends[0]?.tongueM||0),t1=P.plan+Math.max(0,ends[1]?.tongueM||0);
 const stations:number[]=[];for(let s=t0;s<t1-1e-6;){stations.push(s);const d=Math.min(s-t0,t1-s);s+=d<RB.endM+.2?RB.endStepM:RB.spanStepM;}stations.push(t1);
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[],tops:number[]=[];let arc=0,prev:Vec|null=null;
 for(const s of stations){
  const p=P.at(s),q=P.at(Math.min(t1,s+.05)),r=P.at(Math.max(t0,s-.05));
  const T=[q[0]-r[0],q[1]-r[1],q[2]-r[2]],tl=Math.hypot(T[0],T[1],T[2])||1;T[0]/=tl;T[1]/=tl;T[2]/=tl;
  const hl=Math.hypot(T[0],T[2])||1,X:Vec=[T[2]/hl,0,-T[0]/hl]; // same lateral as the old strips (band 0 = side −0.5)
  let N:Vec=[T[1]*X[2]-T[2]*X[1],T[2]*X[0]-T[0]*X[2],T[0]*X[1]-T[1]*X[0]];if(N[1]<0)N=[-N[0],-N[1],-N[2]];
  if(prev)arc+=Math.hypot(p[0]-prev[0],p[1]-prev[1],p[2]-prev[2]);prev=p;
  const d=Math.min(s-t0,t1-s),{ring,w,bottom}=section(d),fade=ss(0,RB.endM,d);
  // end ride: the deck bottom never comes closer than 1.2 cm to the ground under it when the end knows its ground (baked
  // RainbowBridgeGround). Without it (sky city until plan B §8.4) the deck simply follows the path — the draft's "anchor level"
  // floor would lift the whole upper end of a rising bridge (sky leg climbs 12 m), so it is not used.
  let lift=RB.tipLiftM*(1-ss(.6,RB.endM,d));
  const end=s<(t0+t1)/2?ends[0]:ends[1];
  if(d<RB.endM+1.2&&end?.ground){let floor=-Infinity;
   // +1.2 cm over a baked table: its 0.3 m bilinear grid can sit under the real triangles by a few mm
   for(const x of [-w-.03,-w*.5,0,w*.5,w+.03]){const g=end.ground(p[0]+X[0]*x,p[2]+X[2]*x);if(g!==null&&Number.isFinite(g))floor=Math.max(floor,g+.012);}
   const need=floor+RB.clearM-(p[1]+lift+bottom*N[1]);if(need>0)lift+=need;}
  tops.push(p[1]+lift-RB.feetM);
  // vertex normals (only used by the no-derivatives fallback): outward normal of the ring polygon at each vertex. The ring is
  // clockwise in (lateral, up), so the outward normal of an edge (dx,dz) is (−dz,dx).
  const m=ring.length;
  ring.forEach(([x,z,uvx,part,shade],j)=>{
   positions.push(p[0]+X[0]*x+N[0]*z,p[1]+lift+X[1]*x+N[1]*z,p[2]+X[2]*x+N[2]*z);uvs.push(uvx,arc);colors.push(part,shade,fade,1);
   const a=ring[(j+m-1)%m],b=ring[(j+1)%m],e1=[x-a[0],z-a[1]],e2=[b[0]-x,b[1]-z],l1=Math.hypot(e1[0],e1[1])||1,l2=Math.hypot(e2[0],e2[1])||1;
   let nx=-e1[1]/l1-e2[1]/l2,nz=e1[0]/l1+e2[0]/l2;const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
   normals.push(X[0]*nx+N[0]*nz,X[1]*nx+N[1]*nz,X[2]*nx+N[2]*nz);
  });
 }
 const n=RB.ringVerts;
 // Winding: CCW seen from OUTSIDE (cullMode back, frontFace CCW). The ring runs −X → +X across the top, so (a0,a1,b0) faces +N on top.
 for(let i=0;i+1<stations.length;i++)for(let j=0;j<n;j++){const a0=i*n+j,a1=i*n+(j+1)%n,b0=a0+n,b1=a1+n;indices.push(a0,a1,b0,a1,b1,b0);}
 if(!outwardTop(positions,normals,indices))for(let k=0;k<indices.length;k+=3){const t=indices[k+1];indices[k+1]=indices[k+2];indices[k+2]=t;}
 const top=(s:number)=>{let lo=0;while(lo+1<stations.length&&stations[lo+1]<=s)lo++;return tops[Math.min(lo,tops.length-1)];};
 return {positions,normals,uvs,colors,indices,...bounds(positions,[.05,.05,0,.05]),rings:stations.length,stations,top};
}
/** True if the first top triangle's geometric (CCW) normal agrees with its vertex normal. */
function outwardTop(p:number[],nrm:number[],idx:number[]):boolean{
 const [a,b,c]=[idx[0],idx[1],idx[2]],v=(i:number)=>[p[i*3],p[i*3+1],p[i*3+2]];const A=v(a),B=v(b),C=v(c);
 const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]],g=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
 return g[0]*nrm[a*3]+g[1]*nrm[a*3+1]+g[2]*nrm[a*3+2]>0;
}
/** Deterministic RNG (mulberry32) so the ends look the same on every run and in the tests. */
export function rng(seed:number){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
/** End frame: E = path end, F = horizontal unit INTO the span, R = lateral (same side as the deck's X). */
function endFrame(path:readonly Vec[],which:0|1){const P=pathSampler(path),s=which===0?0:P.plan,E=P.at(s),inner=P.at(which===0?Math.min(P.plan,3):Math.max(0,P.plan-3));
 const dx=inner[0]-E[0],dz=inner[2]-E[2],l=Math.hypot(dx,dz)||1,F=[dx/l,dz/l],R=which===0?[F[1],-F[0]]:[-F[1],F[0]];return {E,F,R,P};}
const HALO={landM:2.3,underM:1.6,sideM:1.75,cols:9,rows:7} as const;
function dropMask(g:number|null,endY:number){return g===null?0:1-ss(.35,.6,Math.abs(g-endY));}
/** Halo + petals + flowers for every capped end, one mesh (one DC). a_normal = (seed, kind, size): kind 0 halo (additive), 4 solid. */
export function rainbowGroundGeometry(path:readonly Vec[],ends:readonly [RainbowEnd|null,RainbowEnd|null]):RainbowGeometry&{halos:number;petals:number;flowers:number}{
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];let halos=0,petals=0,flowers=0;
 const vert=(p:Vec,c:[number,number,number,number],seed:number,kind:number,size=0)=>{positions.push(p[0],p[1],p[2]);normals.push(seed,kind,size);uvs.push(0,0);colors.push(c[0],c[1],c[2],c[3]);return positions.length/3-1;};
 ([0,1] as const).forEach(which=>{
  const end=ends[which];if(!end||end.cap===false||!end.ground)return;const G=end.ground,surf=end.surface,{E,F,R}=endFrame(path,which),tongue=Math.max(0,end.tongueM||0);
  const at=(u:number,l:number):[number,number]=>[E[0]+F[0]*u+R[0]*l,E[2]+F[1]*u+R[1]*l];
  // halo: 9×7 verts (8×6 quads, 96 tris) draped 2.5 cm over the ground, colour across, radial alpha falloff
  const base=positions.length/3;
  for(let r=0;r<HALO.rows;r++)for(let c=0;c<HALO.cols;c++){
   const u=lerp(-HALO.landM,HALO.underM,c/(HALO.cols-1)),l=lerp(-HALO.sideM,HALO.sideM,r/(HALO.rows-1)),[x,z]=at(u,l),g=G(x,z);
   const e=Math.hypot(u/(u<0?HALO.landM:HALO.underM),l/HALO.sideM),a=(1-ss(.3,1,e))*.9*dropMask(g,E[1]),col=paleBand(.5+l/(2*HALO.sideM)*(which===0?1:-1));
   vert([x,(g??E[1])+RB.haloLiftM,z],[col[0],col[1],col[2],a],0,0);}
  for(let r=0;r+1<HALO.rows;r++)for(let c=0;c+1<HALO.cols;c++){const i=base+r*HALO.cols+c;indices.push(i,i+HALO.cols,i+1,i+1,i+HALO.cols,i+HALO.cols+1);}
  halos++;
  // a spot is usable when the ground there is near the landing level AND locally planar over ±0.3 m (one grid step; slopes are
  // fine, steps / rock tops / the cliff edge are not)
  const rand=rng(0x5eed+which*977),ok=(u:number,l:number,tol:number)=>{const [x,z]=at(u,l),g=G(x,z);if(g===null||Math.abs(g-E[1])>=.35)return null;
   // never on a cell the bake marked rough ('r': pebble / rim / step under one grid step), checked on the 4 cells around the spot
   if(surf&&[[.15,.15],[.15,-.15],[-.15,.15],[-.15,-.15]].some(([dx,dz])=>surf(x+dx,z+dz)==='r'))return null;
   for(const [dx,dz,k] of [[.3,0,1],[0,.3,1],[.21,.21,1],[.21,-.21,1],[.15,0,.4],[0,.15,.4]]){const a=G(x+dx,z+dz),b=G(x-dx,z-dz);if(a===null||b===null||Math.abs((a+b)/2-g)>tol*k||Math.abs(a-b)>.3)return null;}return g;};
  // 34 petals lying on the ground (rhombus, 5–8.5 cm), coloured by the band under them
  for(let tries=0,n=0;n<34&&tries<600;tries++){
   const u=lerp(-2,1.3,rand()),l=lerp(-1.6,1.6,rand()),g=ok(u,l,.015);if(g===null)continue;if(Math.hypot(u/(u<0?2:1.3),l/1.6)>1)continue;
   const [x,z]=at(u,l),len=lerp(.05,.085,rand()),wid=len*.45,ang=rand()*Math.PI*2,ca=Math.cos(ang),sa=Math.sin(ang),col=paleBand(.5+l/3.2*(which===0?1:-1)),seed=rand();
   // each corner sits on the ground under it (a petal follows the slope instead of floating over it)
   const P=(a:number,b:number):Vec=>{const px=x+ca*a-sa*b,pz=z+sa*a+ca*b,h=G(px,pz);return [px,(h??g)+RB.petalLiftM,pz];},cc:[number,number,number,number]=[col[0],col[1],col[2],1];
   const i0=vert(P(-len/2,0),cc,seed,4),i1=vert(P(0,wid/2),cc,seed,4),i2=vert(P(len/2,0),cc,seed,4),i3=vert(P(0,-wid/2),cc,seed,4);
   indices.push(i0,i2,i1,i0,i3,i2);n++;petals++;}
  // 8 little rainbow flowers: grass only, never on the path, the deck (+0.3 m) or within 0.6 m of her walk
  const avoid=end.avoid||[];
  for(let tries=0,n=0;n<8&&tries<900;tries++){
   const u=lerp(-2.2,1.2,rand()),l=(rand()<.5?-1:1)*lerp(1.0,1.75,rand()),g=ok(u,l,.01);if(g===null)continue;
   if(u>-tongue-.3&&Math.abs(l)<RB.width/2+RB.flareM+.3)continue;
   const [x,z]=at(u,l);if(surf&&surf(x,z)!=='g')continue;
   if(avoid.some(a=>Math.hypot(a[0]-x,a[2]-z)<.6))continue;
   const h=lerp(.1,.18,rand()),stem:[number,number,number,number]=[.36,.62,.3,1],head=paleBand(rand(),.9),hc:[number,number,number,number]=[head[0],head[1],head[2],1],seed=rand(),sw=.007;
   for(const [ax,az] of [[1,0],[0,1]]){const a=vert([x-ax*sw,g,z-az*sw],stem,seed,4),b=vert([x+ax*sw,g,z+az*sw],stem,seed,4),c=vert([x+ax*sw,g+h,z+az*sw],stem,seed,4),d=vert([x-ax*sw,g+h,z-az*sw],stem,seed,4);indices.push(a,b,c,a,c,d);}
   const cI=vert([x,g+h+.006,z],[1,.93,.6,1],seed,4),rr=lerp(.025,.035,rand()),ph=rand()*6.283,rim:number[]=[];
   for(let k=0;k<5;k++){const t=ph+k*Math.PI*2/5;rim.push(vert([x+Math.cos(t)*rr,g+h,z+Math.sin(t)*rr],hc,seed,4));}
   for(let k=0;k<5;k++)indices.push(cI,rim[(k+1)%5],rim[k]);
   n++;flowers++;}
 });
 return {positions,normals,uvs,colors,indices,...bounds(positions.length?positions:[0,0,0],[.05,.25,0,.05]),halos,petals,flowers};
}
/** Mote kinds (a_normal.y): 1 glow dot (additive, rises), 2 falling petal (alpha, spins), 3 curb sparkle (additive, twinkles).
 *  Each is one camera-facing quad animated in rainbow-bridge-additive.effect (the mote path of rbh-vs:vert); a_color.w = rise (1) / drop (2). */
export function rainbowMotesGeometry(path:readonly Vec[],ends:readonly [RainbowEnd|null,RainbowEnd|null],deck?:{top:(s:number)=>number}):RainbowGeometry&{count:{glow:number;petals:number;curb:number;total:number}}{
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];const count={glow:0,petals:0,curb:0,total:0};
 const P=pathSampler(path),top=deck?deck.top:(s:number)=>P.at(s)[1]-RB.feetM;
 const quad=(p:Vec,c:[number,number,number,number],seed:number,kind:number,size:number)=>{const b=positions.length/3;
  for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){positions.push(p[0],p[1],p[2]);normals.push(seed,kind,size);uvs.push(cx,cy);colors.push(c[0],c[1],c[2],c[3]);}
  indices.push(b,b+1,b+2,b,b+2,b+3);count.total++;};
 ([0,1] as const).forEach(which=>{
  const end=ends[which];if(!end||end.cap===false||!end.ground)return;const G=end.ground,{E,F,R}=endFrame(path,which),tongue=Math.max(0,end.tongueM||0),rand=rng(0xa11ce+which*131);
  const sOf=(u:number)=>which===0?u:P.plan-u,at=(u:number,l:number):[number,number]=>[E[0]+F[0]*u+R[0]*l,E[2]+F[1]*u+R[1]*l];
  for(let n=0;n<RAINBOW_PARTICLES.glowPerEnd;n++){const u=lerp(-1.5,2.5,rand()),l=lerp(-1.2,1.2,rand()),[x,z]=at(u,l),g=G(x,z);
   const onDeck=u>=-tongue,y=onDeck?top(sOf(u))+.02:(g??E[1])+.03;quad([x,y,z],[1,.85,.55,lerp(.15,1.5,rand())],rand(),1,lerp(.005,.01,rand()));count.glow++;}
  for(let n=0;n<RAINBOW_PARTICLES.petalsPerEnd;n++){const u=lerp(.2,2.4,rand()),l=lerp(-1.1,1.1,rand()),[x,z]=at(u,l),g=G(x,z),y0=top(sOf(u))+lerp(.05,.3,rand());
   const drop=g!==null&&g<y0?Math.min(3,y0-g-RB.petalLiftM):1,c=paleBand(.5+l/2.2*(which===0?1:-1),.8);quad([x,y0,z],[c[0],c[1],c[2],drop],rand(),2,lerp(.022,.03,rand()));count.petals++;}
 });
 if(ends.some(e=>e&&e.cap!==false&&e.ground)){const rand=rng(0xc0b);
  for(let n=0;n<RAINBOW_PARTICLES.curb;n++){const s=lerp(RB.endM+.5,P.plan-RB.endM-.5,(n+rand()*.8)/RAINBOW_PARTICLES.curb),p=P.at(s),q=P.at(Math.min(P.plan,s+.05)),dx=q[0]-p[0],dz=q[2]-p[2],l=Math.hypot(dx,dz)||1,side=n%2?1:-1;
   const X=[dz/l,-dx/l],w=RB.width/2-RB.curbW*.3;quad([p[0]+X[0]*w*side,top(s)+RB.feetM+RB.curbM+.02,p[2]+X[1]*w*side],[1,.95,.8,0],rand(),3,lerp(.008,.014,rand()));count.curb++;}}
 if(count.total>RAINBOW_PARTICLES.max)throw Error('rainbow-bridge-particles');
 return {positions,normals,uvs,colors,indices,...bounds(positions.length?positions:[0,0,0],[.2,1.7,0,3.1]),count};
}
/** Ground sampler from a baked RainbowBridgeGround table (see tools/rainbow-bridge/bake-ground.cjs).
 *  frame 'world': (x,z) are absolute world; frame 'end': relative to `end` (the region model is placed rigidly at the end). */
export interface RainbowGroundTable{readonly id:string;readonly frame:'world'|'end';readonly at:readonly [number,number,number];readonly half:number;readonly step:number;readonly data:string;}
export function groundFromTable(t:RainbowGroundTable,end:Vec):{ground:GroundFn;surface:SurfaceFn}{
 const n=Math.round(2*t.half/t.step)+1;if(t.data.length!==n*n*3)throw Error('rainbow-ground-table:'+t.id);
 const ox=t.frame==='world'?t.at[0]:end[0],oz=t.frame==='world'?t.at[2]:end[2],oy=t.frame==='world'?t.at[1]:end[1];
 const cell=(i:number,j:number):{h:number|null;c:string}=>{if(i<0||j<0||i>=n||j>=n)return {h:null,c:''};const k=(j*n+i)*3,c=t.data[k];if(c==='0')return {h:null,c:''};return {h:(parseInt(t.data.substr(k+1,2),36)-640)/100+oy,c};};
 const ground:GroundFn=(x,z)=>{const fx=(x-ox+t.half)/t.step,fz=(z-oz+t.half)/t.step,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
  const a=cell(i,j),b=cell(i+1,j),c=cell(i,j+1),d=cell(i+1,j+1);
  if(a.h!==null&&b.h!==null&&c.h!==null&&d.h!==null)return lerp(lerp(a.h,b.h,u),lerp(c.h,d.h,u),v);
  const near=[[a,(1-u)*(1-v)],[b,u*(1-v)],[c,(1-u)*v],[d,u*v]] as Array<[{h:number|null},number]>;let best:number|null=null,bw=-1;for(const [q,w] of near)if(q.h!==null&&w>bw){bw=w;best=q.h;}return best;};
 const surface:SurfaceFn=(x,z)=>cell(Math.round((x-ox+t.half)/t.step),Math.round((z-oz+t.half)/t.step)).c;
 return {ground,surface};
}
