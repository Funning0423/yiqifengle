/** T-02 (运镜bot, Grok Bot approved Oct 25): the last skycity shot before the lakeside set-off.
 * Old: finaleLook — 26 m back, 6 m up, fov 58, aimed between her head and the star-ring centre 20 m above her: mostly empty sky,
 * she ≈ 4 % of the frame (ISSUES T-02, shots/T02_sky_end_day.png).
 * New: a low hero angle a few metres from her, looking up past her at the near arc of the star ring (env_sky_starring, a 47 m
 * tilted ring at y 13–27 over the S6 plateau), so she, the ring and the city between fill the portrait frame.
 * Engine-free and deterministic: the stage passes her feet, her facing, the ring sample points and the skycity lens boxes, all in
 * ONE frame (skycity model-local = walk-local, or world). Constraints on ALL 7 portrait screens: her body inside the safe margins,
 * head/chest not hidden (guardEval), lens ≥ minClearM (1.1 m) from every box and not inside one, lens in front of her (face seen).
 * Kept: her ≥ minHerShare of the frame height and ≥ minRingShare of the ring samples on screen (worst screen each); score = ring share +
 * her share (a low side angle: her at a quarter of the frame, the ring arc across the top, the city between). */
type V3=[number,number,number];
export const SKY_FINALE={fovDeg:50,minClearM:1.1,minRingShare:0.08,minHerShare:0.2,faceYawMaxDeg:180,
 /** approachS: shortest eased approach; holdS: seconds the shot is held (from the reward claim) before auto-continue; any input cancels it */
 approachS:1.4,holdS:5.5,bodyM:[0.05,1.6] as readonly [number,number]};
/** Projected point: ndc x/y (|·| ≤ 1 on screen) for a look-at pose; null behind the lens. */
export function ndc(P:readonly number[],T:readonly number[],fov:number,W:number,H:number,q:readonly number[]):[number,number]|null{
 const f=[T[0]-P[0],T[1]-P[1],T[2]-P[2]],fl=Math.hypot(f[0],f[1],f[2])||1;for(let i=0;i<3;i++)f[i]/=fl;
 let r=[f[2],0,-f[0]];const rl=Math.hypot(r[0],r[2])||1;r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const d=[q[0]-P[0],q[1]-P[1],q[2]-P[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(z<=0.05)return null;
 const tv=Math.tan(fov*Math.PI/360),th=tv*W/H;return [(d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/(z*th),(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/(z*tv)];}
/** The shot for S6 (end of planWalk S4→S6, facing −148°). T-02 option C (Grok Bot, Oct 25): her + the city, no ring requirement
 * (A2 — a ring arc across ≥60 % of the frame width with fov ≤ 60 and no up-tilt — has no pose: the ring never enters the upper frame).
 * Rear 3/4 (50° off her back), 6 m arm, lens 1.3 m up, fov 45; found by a real-mesh search (clearance ≥ 1.1 m, head/chest clear,
 * city share) and baked so the player build does no search. test_t02_sky_final checks it per screen. skycity model-local. */
/** b19 P1 (界面验收部 d3fe578e: parked under the city, underside 69 % of the upper half, sky 5.6 %): pulled back 8.5 m out from
 *  under the canopy, rear 3/4 (25° off her back), lens 1.5 m up, pitched 2° UP toward the distant city, her on the left third with
 *  lead room toward the city. Proxy (env_skycity.glb rays): sky 40.9–48 %, underside ≤ 21.9 % of the upper half, 7 screens.
 *  Old option C pose: SKY_FINALE_POSE_LOCAL_C (tools-only, tools/asset-companions/region/SkyFinaleShot.ts). */
/** full9c: shifted by the stand move old planWalk end (0.941,0.044,-27.059) → S6 node (0.2,0.034,-27.8): Δ (−0.741,−0.0095,−0.741), rigid (same arm, angle, fov). Was position [1.972,1.542,-18.668] target [0.377,1.839,-27.012]. */
/** full9c: the walk lens city aim point (finaleCity of the composed finale lens) is a fixed landmark — moving her stand must not drag it (it drove SKY_5A_WALK_PLAN arm -1.2→-2.2) */
export const SKY_FINALE_CITY_LOCAL:V3=[-9.286,3.638,-77.565];
export const SKY_FINALE_POSE_LOCAL={position:[1.231,1.692,-19.409] as V3,target:[-0.364,1.989,-27.753] as V3,fovVerticalDeg:45};
