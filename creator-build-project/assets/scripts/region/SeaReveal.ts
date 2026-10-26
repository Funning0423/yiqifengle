import type {Pose,Vec} from '../world-r1/WorldFlowCore';
/** full8 plan E (场景设计部 PROPOSAL 2026-10-26 sea-distance, Grok Bot approved): the island→meadow sail reads as open sea.
 *  The real meadow is not drawn from the set-off; a small far stand-in sits on the horizon in the meadow's bearing (~480 m).
 *  Handoff stand-in → real meadow at SEA_HANDOFF_T (sail timeline seconds) ONLY when both boxes are outside the camera frustum;
 *  otherwise it is deferred (never swapped on screen). Pure, no cc. */
export const SEA_STANDIN={pos:[-11.6,-0.91,492.0] as Vec,scale:.7,yawDeg:180};
export const SEA_HANDOFF_T=17.4;
/** Southern lowland of the sail copy of env_meadow: world z < 45 terrain / river bank verts go to y ≤ −1.3 (restored after docking). */
export const SEA_LOWLAND={zMax:45,y:-1.3,meshes:/^(meadow_terrain|meadow_river_bank)$/};
/** Real-meadow prewarm: drawn this many frames under the set-off cover (shaders/batches built), then hidden until the handoff. */
export const SEA_PREWARM_FRAMES=2;
export const SEA_CAM={near:.3,far:1400};
export type Box={min:Vec;max:Vec};
export function lowlandY(x:number,y:number,z:number,k=SEA_LOWLAND):number{void x;return z<k.zMax&&y>k.y?k.y:y;}
const sub=(a:Vec,b:Vec):Vec=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 dot=(a:Vec,b:Vec)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=(a:Vec):Vec=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
/** Conservative frustum test: false only when every corner lies outside one frustum plane (box surely off screen). */
export function boxInFrustum(cam:Pose,aspect:number,b:Box,k=SEA_CAM):boolean{
 const f=norm(sub(cam.target,cam.position)),r=norm(cross(f,[0,1,0])),u=cross(r,f),ty=Math.tan((cam.fovVerticalDeg??45)*Math.PI/360),tx=ty*aspect;
 const cs:Vec[]=[];for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]])cs.push(x===undefined?[0,0,0]:[x,y,z]);
 const view=cs.map(p=>{const d=sub(p,cam.position);return [dot(d,r),dot(d,u),dot(d,f)] as Vec;});
 const out=(fn:(v:Vec)=>boolean)=>view.every(fn);
 if(out(v=>v[2]<k.near)||out(v=>v[2]>k.far))return false;
 if(out(v=>v[0]>v[2]*tx)||out(v=>v[0]<-v[2]*tx)||out(v=>v[1]>v[2]*ty)||out(v=>v[1]<-v[2]*ty))return false;
 return true;}
export type SeaRevealPhase='standin'|'pending'|'real';
export type SeaReveal={phase:SeaRevealPhase;handoffAt:number|null;deferredS:number;
 step(t:number,standinVisible:boolean,realVisible:boolean):SeaRevealPhase};
/** standin → (t ≥ handoffT) pending → real at the first frame where neither box is in the frustum. */
export function createSeaReveal(handoffT=SEA_HANDOFF_T):SeaReveal{
 const s:SeaReveal={phase:'standin',handoffAt:null,deferredS:0,
  step(t,a,b){if(s.phase==='real')return s.phase;if(t+1e-9<handoffT)return s.phase;s.phase='pending';
   if(!a&&!b){s.phase='real';s.handoffAt=t;s.deferredS=Math.max(0,t-handoffT);}return s.phase;}};
 return s;}
/** Fraction of a 1×1 screen covered by the projected box (axis-aligned screen rect of the visible corners, clipped). Report metric. */
export function boxScreenFrac(cam:Pose,aspect:number,b:Box):number{
 const f=norm(sub(cam.target,cam.position)),r=norm(cross(f,[0,1,0])),u=cross(r,f),ty=Math.tan((cam.fovVerticalDeg??45)*Math.PI/360),tx=ty*aspect;
 let x0=1,x1=-1,y0=1,y1=-1,any=false;
 for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]]){const d=sub([x,y,z],cam.position),vz=dot(d,f);if(vz<SEA_CAM.near)continue;any=true;
  const sx=dot(d,r)/(vz*tx),sy=dot(d,u)/(vz*ty);x0=Math.min(x0,sx);x1=Math.max(x1,sx);y0=Math.min(y0,sy);y1=Math.max(y1,sy);}
 if(!any)return 0;const cx0=Math.max(-1,x0),cx1=Math.min(1,x1),cy0=Math.max(-1,y0),cy1=Math.min(1,y1);
 return cx1>cx0&&cy1>cy0?(cx1-cx0)*(cy1-cy0)/4:0;}
/** 场景设计部 deliverables (prefabs under resources); until they exist SailArt uses the coast card / sea rocks as placeholders. */
export const SEA_STANDIN_PREFAB='far_meadow_impostor',SEA_REEF_PREFAB='sea_reef_cluster';
/** Reef cluster slots [x, yawRad, z] off the route mid-leg (well clear of the 9 m sail lane). */
export function seaReefSlots(start:Vec,end:Vec):[number,number,number][]{
 const mx=(start[0]+end[0])/2,mz=(start[2]+end[2])/2;
 return [[mx+46,.6,mz-30],[mx-58,2.1,mz+12],[end[0]+64,4.0,end[2]-48]];}
/** Plan E needs 运镜bot's open-sea lateral shot (PROPOSAL §2.2/§3: lens looks away from the meadow in 11.4–18.0 s). With the current
 *  sailCamera the lens faces the meadow the whole leg, so a frustum-safe handoff never exists. Until that camera lands plan E is
 *  opt-in: `?seaReveal=1` or globalThis.__QF_SEA_REVEAL=true; set SEA_REVEAL_DEFAULT=true when the camera + mesh are in. */
export const SEA_REVEAL_DEFAULT=false;
export function seaRevealEnabled():boolean{
 const g=globalThis as any;if(g.__QF_SEA_REVEAL===true)return true;if(g.__QF_SEA_REVEAL===false)return false;
 try{const q=String(g.location?.search||'');if(/[?&]seaReveal=1\b/.test(q))return true;if(/[?&]seaReveal=0\b/.test(q))return false;}catch{}
 return SEA_REVEAL_DEFAULT;}
/** Prototype open-sea lateral lens (PROPOSAL §2.2): boat + (−7.5, 2.6, 0.6) looking at boat + (30, 0.6, −9), fov 46. Test reference only. */
export function seaLateralPose(boat:Vec):{position:Vec;target:Vec;fovVerticalDeg:number}{
 return {position:[boat[0]-7.5,boat[1]+2.6,boat[2]+.6],target:[boat[0]+30,boat[1]+.6,boat[2]-9],fovVerticalDeg:46};}
export function seaClipLowland(b:Box,k=SEA_LOWLAND):Box{return {min:[b.min[0],b.min[1],Math.max(b.min[2],k.zMax)],max:[b.max[0],b.max[1],Math.max(b.max[2],k.zMax)]};}
/** Meshes of the sail copy that stay drawn through the reveal: the river mouth (z 30–53, the dug sailing channel) is water at sea
 *  level the boat sails on, so it is part of the open sea, not of the hidden island, and is excluded from the frustum test. */
export const SEA_ALWAYS_DRAWN=/^meadow_river$/;
