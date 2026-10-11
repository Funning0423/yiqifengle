'use strict';
/** Lens-coverage rays (Mac round 2 f0f3a13: palm trunks swept across the LENS, not across her).
 * For a camera pose cast a COLSxROWS grid of rays (cell centres, 16x32 for the 586x1266 portrait) through the real frustum
 * (vertical FOV from the pose, aspect 586/1266) and report, per ray, the first decoded-GLB mesh (skinned-mesh decoder v2
 * + T9 props) within NEAR_M and within COVER_M of the lens.
 * NEAR_M = 1.0 m: at the ~55-75 deg vertical FOV used, a 30 cm palm trunk at 1 m spans ~25-30% of the frame width, and
 * anything closer reads as a wipe/blackout. A sensible "nothing big is right in front of the lens" bound that the
 * doorway/room architecture is NOT exempt from except where listed in ARCH (the lens legitimately passes through the
 * door frame and lives inside the room; that is covered by collision:lens-clearance >= 0.15 m instead).
 * COVER_M = 2.5 m: reported only (fraction of the frame blocked by geometry within 2.5 m). */
// Non-occluding FX (场景特效bot fx_lighthouse_beam / fx_lighthouse_glow / fx_lighthouse_seaglint / fx_chimney_smoke + puffs, any fx_*)
// are additive and fade to 0 near the camera in shader: they are NOT in the ray index (glb_geometry IGNORE ^fx_ plus sky/sea/
// cloud/smoke/glass/beam/glow), so they can never count as a lens hit.
const NEAR_M=1.0,COVER_M=2.5,COLS=16,ROWS=32;
/** Architecture the lens is allowed near (room interior + tower shell/door frame while crossing). Props, palms, fences,
 * bushes, rocks, island terrain props and T9 props are NOT in this list. */
const ARCH=/^env_(interior_shell|interior_props_merged|int_anim_|lighthouse_ext|rear_window_)/;
function rays(C,cam,aspect){const th=Math.tan(cam.fovVerticalDeg*Math.PI/360),out=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const x=((c+.5)/COLS*2-1)*th*aspect,y=(1-(r+.5)/ROWS*2)*th,l=Math.hypot(x,y,1);out.push(C.rotate(cam.rotation,[x/l,y/l,-1/l]));}
  return out;}
/** Door leaf (dynamic, not in the GLB ray index): quad from FirstsliceFacts door_hinge (x 0.72022, z 0, axis +Y), width
 *  1.4404, height 2.4023, swinging outward (+Z) to `deg` (Cocos Ry: closed leaf -X -> (-cos, 0, +sin)). Name
 *  'door_leaf@open' / '@closed' at the ends (doorway architecture, reported) else 'door_leaf' (a prop: fails within NEAR_M). */
const DOOR={hinge:[0.72022,0,0],width:1.4404,height:2.4023};
function doorQuad(deg,openDeg){const a=deg*Math.PI/180;return {name:Math.abs(deg-openDeg)<1e-6?'door_leaf@open':deg<1e-6?'door_leaf@closed':'door_leaf',o:DOOR.hinge,u:[-DOOR.width*Math.cos(a),0,DOOR.width*Math.sin(a)],v:[0,DOOR.height,0]};}
/** Ray p + t*d (|d| = 1) vs quad o + a*u + b*v: t or Infinity. */
function hitQuad(p,d,q){const n=[q.u[1]*q.v[2]-q.u[2]*q.v[1],q.u[2]*q.v[0]-q.u[0]*q.v[2],q.u[0]*q.v[1]-q.u[1]*q.v[0]],den=n[0]*d[0]+n[1]*d[1]+n[2]*d[2];if(Math.abs(den)<1e-12)return Infinity;
  const w=[q.o[0]-p[0],q.o[1]-p[1],q.o[2]-p[2]],t=(n[0]*w[0]+n[1]*w[1]+n[2]*w[2])/den;if(!(t>1e-3))return Infinity;const x=[p[0]+d[0]*t-q.o[0],p[1]+d[1]*t-q.o[1],p[2]+d[2]*t-q.o[2]];
  const uu=q.u[0]*q.u[0]+q.u[1]*q.u[1]+q.u[2]*q.u[2],vv=q.v[0]*q.v[0]+q.v[1]*q.v[1]+q.v[2]*q.v[2],a=(x[0]*q.u[0]+x[1]*q.u[1]+x[2]*q.u[2])/uu,b=(x[0]*q.v[0]+x[1]*q.v[1]+x[2]*q.v[2])/vv;return a>=0&&a<=1&&b>=0&&b<=1?t:Infinity;}
/** Closest distance from point p to quad q. */
function quadDist(p,q){const w=[p[0]-q.o[0],p[1]-q.o[1],p[2]-q.o[2]],uu=q.u[0]*q.u[0]+q.u[1]*q.u[1]+q.u[2]*q.u[2],vv=q.v[0]*q.v[0]+q.v[1]*q.v[1]+q.v[2]*q.v[2];
  const a=Math.max(0,Math.min(1,(w[0]*q.u[0]+w[1]*q.u[1]+w[2]*q.u[2])/uu)),b=Math.max(0,Math.min(1,(w[0]*q.v[0]+w[1]*q.v[1]+w[2]*q.v[2])/vv));return Math.hypot(w[0]-a*q.u[0]-b*q.v[0],w[1]-a*q.u[1]-b*q.v[1],w[2]-a*q.u[2]-b*q.v[2]);}
/** -> {near:{mesh:count}, nearProps:n, nearArch:n, cover:fraction blocked within COVER_M, coverProps:fraction}; quads: extra
 *  dynamic surfaces (e.g. doorQuad) tested analytically, '@open' names count as architecture. */
function sample(C,I,cam,aspect,quads){const p=cam.position,near={},R=rays(C,cam,aspect);let nearProps=0,nearArch=0,cover=0,coverProps=0;const Q=quads||[],arch=n=>ARCH.test(n)||/@(open|closed)$/.test(n);
  for(let i=0;i<R.length;i++){const d=R[i];let qn=null,qt=Infinity;for(let k=0;k<Q.length;k++){const t=hitQuad(p,d,Q[k]);if(t<qt){qt=t;qn=Q[k].name;}}
    if(qt<=NEAR_M){near[qn]=(near[qn]||0)+1;if(arch(qn))nearArch++;else{nearProps++;coverProps++;}cover++;continue;}
    const h1=I.occluded(p,[p[0]+d[0]*(NEAR_M+.05),p[1]+d[1]*(NEAR_M+.05),p[2]+d[2]*(NEAR_M+.05)]);
    if(h1){near[h1]=(near[h1]||0)+1;if(ARCH.test(h1))nearArch++;else nearProps++;cover++;if(!ARCH.test(h1))coverProps++;continue;}
    if(qt<=COVER_M){cover++;if(!arch(qn))coverProps++;continue;}
    const h2=I.occluded(p,[p[0]+d[0]*(COVER_M+.05),p[1]+d[1]*(COVER_M+.05),p[2]+d[2]*(COVER_M+.05)]);if(h2){cover++;if(!ARCH.test(h2))coverProps++;}}
  return {near,nearProps,nearArch,cover:cover/R.length,coverProps:coverProps/R.length};}
/** Animated movers (Mac round 3 night, video 41.7 s: a GLB idle_loop gull wing - env_anim_seagull_fly_01_v22 - swept a
 * corner of the frame on the return crane-down; the static index ignores the flying gulls and poses palms at REST, so
 * lens-near-geometry could not see it). Indexes are built from glb_anim.sweep(): the union of every mover pose over the
 * whole loop (phase-agnostic - the runtime clip phase is not tied to the flow clock), i.e. the gull orbit band and the
 * palm sway envelope. FLYER_NEAR_M = 2.5 m: a 1.1 m gull wingspan at 2.5 m still spans ~45% of the frame height at
 * fov 50-58, anything nearer reads as a dark wipe; no frustum ray may meet the swept orbit within it, and the lens keeps
 * FLYER_CLEAR_M = 2.0 m from it in 3D (out-of-frame passes cannot pop in at the frame edge). Sway: same NEAR_M (1.0 m) as
 * the static props, but against the swept envelope. */
const FLYER=/^env_anim_seagull_fly/,FLYER_NEAR_M=2.5,FLYER_CLEAR_M=2.0;
/** -> {flyerRays, swayRays, who:{mesh:rays}} for one pose; If = flyer sweep index, Is = other movers' sweep index. */
function sampleMovers(C,If,Is,cam,aspect){const p=cam.position,R=rays(C,cam,aspect),who={};let flyerRays=0,swayRays=0;
  for(const d of R){const hf=If.occluded(p,[p[0]+d[0]*(FLYER_NEAR_M+.05),p[1]+d[1]*(FLYER_NEAR_M+.05),p[2]+d[2]*(FLYER_NEAR_M+.05)]);if(hf){flyerRays++;who[hf]=(who[hf]||0)+1;}
    const hs=Is.occluded(p,[p[0]+d[0]*(NEAR_M+.05),p[1]+d[1]*(NEAR_M+.05),p[2]+d[2]*(NEAR_M+.05)]);if(hs){swayRays++;who[hs]=(who[hs]||0)+1;}}
  return {flyerRays,swayRays,who};}
module.exports={NEAR_M,COVER_M,COLS,ROWS,ARCH,DOOR,FLYER,FLYER_NEAR_M,FLYER_CLEAR_M,doorQuad,hitQuad,quadDist,rays,sample,sampleMovers};
