/** 运镜bot full9b: OFFLINE SkyResumeLens planner (moved out of the runtime bundle — option A: the game never plans, it only reads
 *  SkyResumePlans). Used by bake_sky_resume_plans.cjs against the real-mesh voxels (sky_lens_voxels.json). Not under assets: never shipped.
 *  Planner solid = {clear(p,clr), sight(lens,her)} in skycity model-local. */
import type {Vec} from '../../creator-build-project/assets/scripts/world-r1/WorldFlowCore';
import {voxClear,type VoxGrid} from '../../creator-build-project/assets/scripts/region/LensVoxels';
import {SKY_RESUME_LENS,skyTrail,lensAt,aimPose,ndc,arcAt,type SkyResumePlan} from '../../creator-build-project/assets/scripts/region/SkyResumeLens';
export type LensSolid={clear:(p:Vec,clr:number)=>boolean;sight:(a:Vec,b:Vec)=>boolean};
function occAt(g:VoxGrid,p:Vec):boolean{const s=g.size,o=g.origin,N=g.dims,i=Math.floor((p[0]-o[0])/s),j=Math.floor((p[1]-o[1])/s),k=Math.floor((p[2]-o[2])/s);
 if(i<0||j<0||k<0||i>=N[0]||j>=N[1]||k>=N[2])return false;const n=(k*N[1]+j)*N[0]+i;return !!(g.bits[n>>3]&(1<<(n&7)));}
/** segment a→b free of occupied voxels (stops 0.35 m short of b = her) */
export function voxSight(g:VoxGrid,a:Vec,b:Vec):boolean{const d=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),n=Math.ceil(d/0.15);
 for(let i=1;i<n;i++){const u=i/n;if(u*d>d-0.35)break;if(occAt(g,[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]))return false;}return true;}
export function voxSolid(g:VoxGrid):LensSolid{return {clear:(p,c)=>voxClear(g,p,c),sight:(a,b)=>voxSight(g,a,b)};}
export function planSkyResume(P:readonly Vec[],toLocal:(w:Vec)=>Vec,K=SKY_RESUME_LENS,g:LensSolid):SkyResumePlan{
 const {A,trail,trail0,step}=skyTrail(P,K),end=A[A.length-1];
 const pl={P,A,trail,trail0,step},nS=Math.floor(end/step)+1,B=K.backs,Lf=K.lifts,Sd=K.sides,nL=Lf.length,nB=B.length,nc=Sd.length*nB*nL,dec=(c:number)=>({si:Math.floor(c/(nB*nL)),bi:Math.floor(c/nL)%nB,li:c%nL});
 const ok:boolean[][]=[];for(let si=0;si<nS;si++){const s=si*step,her=arcAt(P,A,s),face:Vec=[her[0],her[1]+1.5,her[2]],chest:Vec=[her[0],her[1]+1.2,her[2]],fl=toLocal(face),cl=toLocal(chest),row:boolean[]=[];
  for(const sd of Sd)for(const b of B)for(const l of Lf){const w=lensAt(pl,s,b,l,sd),p=toLocal(w),c=aimPose(w,her);row.push(ndc(c,face,K.minAsp)<=K.frameNdc&&ndc(c,chest,K.minAsp)<=K.frameNdc&&g.clear(p,K.clrM)&&g.sight(p,fl)&&g.sight(p,cl));}ok.push(row);}
 /* DP: cost = lift + 0.6·(4.6−back) (+1e4 if infeasible) + change penalty; |Δlift| ≤ dLiftMax, |Δback| ≤ dBackMax per step... per step = (dLiftMax·stepM) */
 const dl=K.dLiftMax*step+1e-9,db=K.dBackMax*step+1e-9,BIG=1e4,cost=(si:number,c:number)=>{const d=dec(c);return (ok[si][c]?0:BIG)+Lf[d.li]*K.wLift+(4.6-B[d.bi])*K.wBack+Math.abs(Sd[d.si])*K.wSide;};
 /* the grid of lifts/backs is coarser than one step's allowed change, so the DP runs on "levels" with a dwell: allow a 1-level change every
  * ceil(level/(rate·step)) steps — implemented as: change allowed only if |Δ| ≤ one grid level, then the result is smoothed */
 void dl;void db;
 let D=new Float64Array(nc),prev:Int32Array[]=[];for(let c=0;c<nc;c++)D[c]=cost(0,c);
 for(let si=1;si<nS;si++){const E=new Float64Array(nc).fill(Infinity),pr=new Int32Array(nc);
  for(let c=0;c<nc;c++){const d=dec(c),cc=cost(si,c);
   for(let s2=Math.max(0,d.si-1);s2<=Math.min(Sd.length-1,d.si+1);s2++){for(let b2=Math.max(0,d.bi-1);b2<=Math.min(nB-1,d.bi+1);b2++)for(let l2=Math.max(0,d.li-1);l2<=Math.min(nL-1,d.li+1);l2++){const p=(s2*nB+b2)*nL+l2,v=D[p]+cc+(p!==c?K.wChange:0);if(v<E[c]){E[c]=v;pr[c]=p;}}}}
  prev.push(pr);D=E;}
 let c=0;for(let k=1;k<nc;k++)if(D[k]<D[c])c=k;const seq=new Array(nS);seq[nS-1]=c;for(let si=nS-1;si>0;si--){c=prev[si-1][c];seq[si-1]=c;}
 let worst=0;const back0=seq.map(c=>B[dec(c).bi]),side0=seq.map(c=>Sd[dec(c).si]),lift0=seq.map((c,si)=>{if(!ok[si][c])worst++;return Lf[dec(c).li];});
 /* feasibility-preserving smoothing: repeated 5-tap averaging of (back, lift, side); a sample takes the smoothed value only if that lens is
  * still feasible (clearance, sightline, framing) — so the result is as smooth as the geometry allows and never leaves the clear space */
 const feas=(si:number,b:number,l:number,sd:number)=>{const s=si*step,her=arcAt(P,A,s),face:Vec=[her[0],her[1]+1.5,her[2]],chest:Vec=[her[0],her[1]+1.2,her[2]],w=lensAt(pl,s,b,l,sd),p=toLocal(w),c=aimPose(w,her);
  return ndc(c,face,K.minAsp)<=K.frameNdc&&ndc(c,chest,K.minAsp)<=K.frameNdc&&g.clear(p,K.clrM)&&g.sight(p,toLocal(face))&&g.sight(p,toLocal(chest));};
 const back=back0.slice(),lift=lift0.slice(),side=side0.slice(),av=(v:number[],i:number)=>{let t=0;for(let j=-2;j<=2;j++)t+=v[Math.max(0,Math.min(nS-1,i+j))];return t/5;};
 for(let it=0;it<K.smoothIters;it++){const nb=back.map((_,i)=>av(back,i)),nl=lift.map((_,i)=>av(lift,i)),ns=side.map((_,i)=>av(side,i));
  for(let i=0;i<nS;i++){if(feas(i,nb[i],nl[i],ns[i])){back[i]=nb[i];lift[i]=nl[i];side[i]=ns[i];}else if(feas(i,back[i],nl[i],side[i]))lift[i]=nl[i];}}
 return {P,A,s0:0,step,back,lift,side,trail,trail0,feasible:worst===0,worst};}
