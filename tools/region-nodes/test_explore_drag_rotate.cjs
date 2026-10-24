'use strict';
/* P0 drag-rotate (运镜bot). Real input path → real lens code, per region (island, meadow, skycity, lakeside):
 *   touch events → ExploreInput (global `input` TOUCH_*; on the island the IslandLighthouseTouch feed, GGbot 410e1bd5)
 *   → sink → RegionNodeStage.onGesture → aimOrbit → FreeOrbit.drag → RegionNodeStage.tickLens (the per-frame writer)
 *   → occlude (LensGuard on lakeside / island) → writePose (the camera).
 * RegionNodeStage methods are the real source (transpiled out of the class, as test_free_orbit does); scene lookups are stubbed.
 * D1 a 120 pt right drag turns the written camera yaw by ≈ yawPerScreen × 120/390 (±20 %), in every region and state.
 * D2 it STAYS: 3 s after release the lens azimuth round her is within 4° of the player's orbit yaw, and over those 3 s the gap
 *    to it never grows by > 2° (no controller pulls it back: LensGuard swing, the follow lens, a return-to-authored; a LensGuard
 *    crane re-plan may still finish catching up — that closes the gap, it never opens it).
 * States: S1 MapExplore idle after leaving the board (handOrbitBack/disarm), S2 she walks (ground tap → groundWalking),
 *         S3 FollowWalk (node walk) not yet engaged, S4 drag while the orbit is still easing back ('returning').
 * Lakeside / island her positions sit next to trees / the lighthouse so LensGuard is active. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {H,FO,E,OC,LX,IX,Gate,Stage,rig,inputFor,yawOf,wrap,VW,HER,DECK_STAND,S}=require('./explore-stage-harness.cjs');
const DT=1/30,rows=[];let fails=0;
for(const region of ['island','meadow','skycity','lakeside'])for(const state of ['S1','S2','S3','S4']){
 Gate.setExploreEnabled(true);const R=rig(region,state),I=inputFor(region,R.st);
 for(let k=0;k<20;k++){R.st.tickLens(DT);if(state==='S2')R.walk(1.2*DT);}
 const y0=yawOf(R.cam());
 I.start(150,400);for(let k=1;k<=12;k++){I.move(150+k*10,400);R.st.tickLens(DT);if(state==='S2')R.walk(1.2*DT);}I.end(270,400);
 const y1=yawOf(R.cam());for(let k=0;k<30;k++){R.st.tickLens(DT);if(state==='S2')R.walk(1.2*DT);}const ySettled=yawOf(R.cam());
 const az=()=>{const c=R.cam().position,h=R.st.girl();return Math.atan2(h[0]-c[0],h[2]-c[2])*180/Math.PI;},gap=()=>Math.abs(wrap(az()-(R.orbit.yaw+180)));
 let g0=gap(),pull=0;for(let k=0;k<90;k++){R.st.tickLens(DT);if(state==='S2')R.walk(1.2*DT);const g=gap();pull=Math.max(pull,g-g0);g0=Math.min(g0,g);}const y2=yawOf(R.cam()),endGap=gap();
 const turn=Math.abs(wrap(ySettled-y0)),expect=128*120/390/* ORBIT_FEEL.yawPerScreen=128 */,drift=Math.abs(wrap(y2-ySettled));
 const D1=turn>=expect*0.8,D2=endGap<=4&&pull<=2;if(!D1||!D2)fails++;
 rows.push({region,state,turnDeg:+turn.toFixed(1),expectDeg:+expect.toFixed(1),driftAfter3sDeg:+drift.toFixed(1),gapToPlayerYawDeg:+endGap.toFixed(1),pullBackDeg:+pull.toFixed(1),D1,D2,orbitMode:R.orbit.mode});
 Gate.setExploreEnabled(false);}
console.table(rows);
/* P1 pitch (Grok Bot: keep r14 direction — drag up lowers the lens — no invert). Extreme vertical drags per region × the 7 route
 * screens × {slow 1.5-screen up, slow down, fast flick up, fast flick down, alternating flicks, flick while walking}:
 *  P1 elevation of the lens over her look point (feet + 1.15 m) stays in [PITCH_MIN−0.5°, ELEV_MAX] every frame,
 *     FreeOrbit.pitch stays in [pitchMinDeg, pitchMaxDeg] (limits ⊂ [5°, 65°]);
 *  P2 lens ≥ 1.0 m above her feet, and on lakeside ≥ 0.5 m above the walk floor / deck under the lens;
 *  P3 no flip: lens never over her head (plan distance ≥ 0.5 m), no yaw jump > 20° between frames on a pure vertical drag,
 *     view never points upward (target below the lens's horizon: forward.y < 0.05).
 *  P4 direction: a drag up ends lower than a drag down. */
const W=H.load(S('region/RegionWalkable.ts')),SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const PMIN=5,PMAX=65,ELEV_MAX=70;
const prow=[];let pfails=0;
const SCN={up:{dy:+1.5,frames:30},down:{dy:-1.5,frames:30},flickUp:{dy:+1.2,frames:2},flickDown:{dy:-1.2,frames:2},alt:{alt:true},walkFlick:{dy:+1.2,frames:2,walk:true}};
for(const [region,stand,tag] of [['island'],['meadow'],['skycity'],['lakeside'],['lakeside',DECK_STAND,'lakeside@deck']])for(const scr of SCREENS)for(const [name,sc] of Object.entries(SCN)){
 VW[0]=scr[0];VW[1]=scr[1];Gate.setExploreEnabled(true);const R=rig(region,sc.walk?'S2':'S1',stand),I=inputFor(region,R.st),L=FO.ORBIT_LIMITS[region];
 let minEl=1e9,maxEl=-1e9,minHead=1e9,minDeck=1e9,minPlan=1e9,maxJump=0,maxFy=-1e9,pMin=1e9,pMax=-1e9,prevYaw=null;
 const her=()=>R.st.girl();
 const sample=()=>{const c=R.cam(),h=her(),dx=c.position[0]-h[0],dz=c.position[2]-h[2],pl=Math.hypot(dx,dz),el=Math.atan2(c.position[1]-(h[1]+1.15),pl)*180/Math.PI;
  minEl=Math.min(minEl,el);maxEl=Math.max(maxEl,el);minHead=Math.min(minHead,c.position[1]-h[1]);minPlan=Math.min(minPlan,pl);
  if(region==='lakeside'){const fl=W.walkFloorY('lakeside',c.position[0],c.position[2]);if(fl!==null)minDeck=Math.min(minDeck,c.position[1]-fl);}
  const f=[c.target[0]-c.position[0],c.target[1]-c.position[1],c.target[2]-c.position[2]],fl2=Math.hypot(...f);maxFy=Math.max(maxFy,f[1]/fl2);
  const y=yawOf(c);if(prevYaw!==null)maxJump=Math.max(maxJump,Math.abs(wrap(y-prevYaw)));prevYaw=y;pMin=Math.min(pMin,R.orbit.pitch);pMax=Math.max(pMax,R.orbit.pitch);};
 const tick=()=>{R.st.tickLens(DT);if(sc.walk)R.walk(1.2*DT);};
 for(let k=0;k<10;k++)tick();
 const x=VW[0]/2,y0=VW[1]/2;let yEnd=null;
 const drag=(dy,frames)=>{I.start(x,y0);for(let k=1;k<=frames;k++){I.move(x,y0+dy*VW[1]*k/frames);tick();if(R.orbit.engaged())sample();}I.end(x,y0+dy*VW[1]);};
 if(sc.alt){for(let r=0;r<4;r++){drag(r%2?-1.2:1.2,2);for(let k=0;k<6;k++){tick();sample();}}}
 else drag(sc.dy,sc.frames);
 for(let k=0;k<60;k++){tick();sample();}
 yEnd=R.cam().position[1]-her()[1];
 const P1=minEl>=PMIN-0.5&&maxEl<=ELEV_MAX&&pMin>=L.pitchMinDeg-1e-6&&pMax<=L.pitchMaxDeg+1e-6&&L.pitchMinDeg>=PMIN&&L.pitchMaxDeg<=PMAX;
 const P2=minHead>=1.0&&(region!=='lakeside'||minDeck>=0.5),P3=minPlan>=0.5&&maxJump<=20&&maxFy<0.05;
 if(!P1||!P2||!P3)pfails++;
 prow.push({region:tag||region,screen:scr.join('x'),scn:name,minEl:+minEl.toFixed(1),maxEl:+maxEl.toFixed(1),pitch:`${pMin.toFixed(1)}..${pMax.toFixed(1)}`,minHeadM:+minHead.toFixed(2),minDeckM:minDeck<1e8?+minDeck.toFixed(2):null,minPlanM:+minPlan.toFixed(2),maxYawJump:+maxJump.toFixed(1),maxFwdY:+maxFy.toFixed(2),endH:+yEnd.toFixed(2),P1,P2,P3});
 Gate.setExploreEnabled(false);}
// P4 direction (r14 kept): per region at 390x844, end height after slow up < after slow down
const dir={};for(const r of prow)if(r.screen==='390x844'&&(r.scn==='up'||r.scn==='down'))(dir[r.region]=dir[r.region]||{})[r.scn]=r.endH;
for(const [r,v] of Object.entries(dir)){if(r.includes('@'))continue;const ok=v.up<v.down;if(!ok)pfails++;console.log('P4',r,'up→',v.up,'down→',v.down,ok?'ok':'FAIL');}
const bad=prow.filter(r=>!r.P1||!r.P2||!r.P3);
const agg={};for(const r of prow){const a=agg[r.region]=agg[r.region]||{minEl:1e9,maxEl:-1e9,minHeadM:1e9,minDeckM:null,maxYawJump:0,maxFwdY:-1e9,minPlanM:1e9,cases:0,bad:0};
 a.minEl=Math.min(a.minEl,r.minEl);a.maxEl=Math.max(a.maxEl,r.maxEl);a.minHeadM=Math.min(a.minHeadM,r.minHeadM);if(r.minDeckM!==null)a.minDeckM=a.minDeckM===null?r.minDeckM:Math.min(a.minDeckM,r.minDeckM);
 a.maxYawJump=Math.max(a.maxYawJump,r.maxYawJump);a.maxFwdY=Math.max(a.maxFwdY,r.maxFwdY);a.minPlanM=Math.min(a.minPlanM,r.minPlanM);a.cases++;if(!r.P1||!r.P2||!r.P3)a.bad++;}
console.table(agg);if(bad.length)console.table(bad.slice(0,12));
fails+=pfails;
fs.mkdirSync(path.join(__dirname,'../journey-integration/reports'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../journey-integration/reports/explore-drag-rotate.json'),JSON.stringify({status:fails?'FAIL':'PASS',limits:Object.fromEntries(['island','meadow','skycity','lakeside'].map(r=>[r,{pitchMinDeg:FO.ORBIT_LIMITS[r].pitchMinDeg,pitchMaxDeg:FO.ORBIT_LIMITS[r].pitchMaxDeg}])),rows,pitch:{aggregate:agg,rows:prow}},null,1)+'\n');
if(fails){console.error('explore-drag-rotate: FAIL',fails);process.exit(1);}console.log('explore-drag-rotate: ok');
