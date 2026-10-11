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
/** -> {near:{mesh:count}, nearProps:n, nearArch:n, cover:fraction blocked within COVER_M, coverProps:fraction} */
function sample(C,I,cam,aspect){const p=cam.position,near={},R=rays(C,cam,aspect);let nearProps=0,nearArch=0,cover=0,coverProps=0;
  for(let i=0;i<R.length;i++){const d=R[i];const h1=I.occluded(p,[p[0]+d[0]*(NEAR_M+.05),p[1]+d[1]*(NEAR_M+.05),p[2]+d[2]*(NEAR_M+.05)]);
    if(h1){near[h1]=(near[h1]||0)+1;if(ARCH.test(h1))nearArch++;else nearProps++;cover++;if(!ARCH.test(h1))coverProps++;continue;}
    const h2=I.occluded(p,[p[0]+d[0]*(COVER_M+.05),p[1]+d[1]*(COVER_M+.05),p[2]+d[2]*(COVER_M+.05)]);if(h2){cover++;if(!ARCH.test(h2))coverProps++;}}
  return {near,nearProps,nearArch,cover:cover/R.length,coverProps:coverProps/R.length};}
module.exports={NEAR_M,COVER_M,COLS,ROWS,ARCH,rays,sample};
