import type {Node} from 'cc';
import {INFLATE} from './TransitionChain';

/**
 * Hot-air balloon inflate pose.
 *
 * The authored envelope is the full teardrop (mouth at y 3.05, crown at y 10.4).
 * The old runtime multiplied that mesh by INFLATE.flatY 0.12 / flatXZ 0.55 and tried to
 * pin the mouth on the burner ring. Two things went wrong:
 *  - with the pin, the cloth is a rigid disc floating at y ≈ 3–4 while the load frame
 *    (corner poles, grey burner platform, rods, pennant) stands naked underneath;
 *  - applyInflate only learns the pin from world bounds, and if those are not ready on
 *    the first call the drop stays 0, so the cloth collapses toward the origin and the
 *    same frame towers above it (the 2026-11-05 preview).
 *
 * This pose drapes the cloth into the basket and keeps the load frame inside the cloth
 * until the throat is wide enough for the cables to meet the mouth. While any ring of the
 * cloth is still at or below the rim, horizontal scale is capped so the shell stays inside
 * the basket walls, the four rim corners and both door frames. At t = INFLATE.durationS
 * the envelope and the frame are back on their authored transforms, so the cruise look
 * does not move. INFLATE itself (timing, flame, vertical-first) is unchanged.
 */
export const BALLOON_DRAPE=Object.freeze({
  mouthMeshY:3.05,
  crownMeshY:10.4,
  mouthFullY:3.05,
  /** deflated mouth, inside the basket (floor board is y 0.10, rim ≈ 1.12) */
  mouthFlatY:0.22,
  /** plump mound, not a paper disc (old ratio flatY/flatXZ = 0.22) */
  flatSy:0.10,
  /** resting width. The basket cap below can only pull this down, never push it out. */
  flatSxz:0.17,
  /** horizontal scale follows the vertical rise so the bubble stays round */
  roundFollow:0.75,
  /**
   * While any of the cloth is still at or below the rim (doors end at y 1.15), its radius stays
   * inside the basket. Inner wall is about 0.63 m; 0.52 m leaves a gap at the rim corners.
   * Above the rim the cap drops away and the cruise pose is the authored scale 1.
   */
  basketTopY:1.28,
  basketClearR:0.50,
  /** balloon_load_frame bounds in transport_balloon space (split from balloon_basket) */
  frameBaseY:1.096175,
  frameTopY:3.071971,
  flameHomeY:2.625,
  burnerHomeY:2.62,
  /** hide the frame until the throat can cover the cable tops (mouth radius ≈ 0.62) */
  frameShowSxz:0.58,
});

/** Max envelope radius (m) at mesh height, sampled from balloon_envelope. The clearance test checks this table. */
const ENV_RINGS:[number,number][]=[
  [3.05,0.620],[3.54,1.000],[4.03,1.487],[4.52,1.935],[5.01,2.309],[5.50,2.640],
  [5.99,2.819],[6.48,2.958],[6.97,2.989],[7.46,2.946],[7.95,2.860],[8.44,2.590],
  [8.93,2.245],[9.42,1.769],[9.91,1.080],[10.40,0],
];
function envRadiusAt(meshY:number):number{
  const R=ENV_RINGS;
  if(meshY<=R[0][0])return R[0][1];
  const last=R[R.length-1];
  if(meshY>=last[0])return last[1];
  for(let i=1;i<R.length;i++){
    const y0=R[i-1][0],r0=R[i-1][1],y1=R[i][0],r1=R[i][1];
    if(meshY<=y1){const u=(meshY-y0)/(y1-y0);return r0+(r1-r0)*u;}
  }
  return 0;
}
/**
 * Largest sxz that keeps rings at or below the rim inside basketClearR.
 * A ring that has risen through `releaseWindowM` above the rim drops out of the cap
 * on a straight ramp, so the width does not step when one sample ring crosses the rim.
 */
export function basketSxzCap(mouthY:number,sy:number):number{
  const D=BALLOON_DRAPE;
  if(!(sy>1e-4))return D.basketClearR/2.989;
  const fade=0.55;
  let cap=1e9;
  const consider=(h:number)=>{
    const wy=mouthY+(h-D.mouthMeshY)*sy;
    const k=Math.max(0,Math.min(1,(D.basketTopY+fade-wy)/fade));
    if(k<=0)return;
    const r=envRadiusAt(h);
    if(r<1e-4)return;
    const limit=D.basketClearR/r;
    const allowed=limit+(1-k)*8;
    if(allowed<cap)cap=allowed;
  };
  for(let h=D.mouthMeshY;h<=D.crownMeshY;h+=0.02)consider(h);
  return cap;
}

export type BalloonDrapePose={
  sy:number;sxz:number;mouthY:number;crownY:number;
  frameVisible:boolean;frameSy:number;frameSxz:number;frameLocalY:number;
  flameLocalY:number;burnerLocalY:number;
};

/** 0 at t=0, 1 at the end of the inflate. Slow at the start so the cloth domes out of the
 *  basket instead of jumping from a flat pile to a small balloon in the first third of a second.
 *  Flame timing still follows inflateAt in the callers. t >= duration is the authored cruise pose. */
export function swell01(t:number):number{
  if(t>=INFLATE.durationS)return 1;
  const u=Math.max(0,t/INFLATE.durationS);
  const s=u*u*(3-2*u);
  return 0.35*u+0.65*s;
}
export function balloonDrapePose(t:number):BalloonDrapePose{
  const D=BALLOON_DRAPE,w=swell01(t);
  const sy=D.flatSy+(1-D.flatSy)*w;
  const mouthY=w>=1?D.mouthFullY:D.mouthFlatY+(D.mouthFullY-D.mouthFlatY)*w;
  const sxzWant=D.flatSxz+(1-D.flatSxz)*w;
  const sxz=Math.min(sxzWant,basketSxzCap(mouthY,sy));
  const crownY=mouthY+(D.crownMeshY-D.mouthMeshY)*sy;
  const tuck=D.frameTopY-D.mouthFullY;
  const wantTop=Math.min(D.frameTopY,mouthY+tuck);
  const span=D.frameTopY-D.frameBaseY;
  const grown=sxz+1e-6>=D.frameShowSxz&&wantTop>D.frameBaseY+0.12;
  const frameSy=grown?Math.min(1,Math.max(0,(wantTop-D.frameBaseY)/span)):0;
  // Feet stay on the basket corners. Folding XZ pulled the burner off the rim and left a floating platform.
  const frameSxz=1;
  const frameLocalY=D.frameBaseY*(1-frameSy);
  const flameOnFrame=D.frameBaseY+(D.flameHomeY-D.frameBaseY)*frameSy;
  const flameLocalY=frameSy>0.02?flameOnFrame:Math.min(crownY-0.45,Math.max(0.45,mouthY+0.15));
  const burnerLocalY=frameSy>0.02?D.frameBaseY+(D.burnerHomeY-D.frameBaseY)*frameSy:flameLocalY;
  return {sy,sxz,mouthY,crownY,frameVisible:frameSy>0.02,frameSy,frameSxz,frameLocalY,flameLocalY,burnerLocalY};
}

type Trs={x:number;y:number;z:number};
type EnvelopeLike={setScale:(x:number,y:number,z:number)=>void;setPosition:(x:number,y:number,z:number)=>void};

/** Local Y that puts the envelope mouth on pose.mouthY. Authored home is local y -3.05, scale 1, mouth at 3.05. */
export function envelopeLocalY(pose:BalloonDrapePose,home:{p:Trs;s:Trs}):number{
  const D=BALLOON_DRAPE;
  return home.p.y+(pose.mouthY-D.mouthFullY)-D.mouthMeshY*home.s.y*(pose.sy-1);
}

export function applyEnvelopeDrape(envelope:EnvelopeLike,t:number,home:{p:Trs;s:Trs}):void{
  const pose=balloonDrapePose(t);
  envelope.setScale(home.s.x*pose.sxz,home.s.y*pose.sy,home.s.z*pose.sxz);
  envelope.setPosition(home.p.x,envelopeLocalY(pose,home),home.p.z);
}

const homeY=new WeakMap<Node,number>();
function authoredY(node:Node):number{
  const hit=homeY.get(node);
  if(hit!==undefined)return hit;
  const y=node.position.y;
  homeY.set(node,y);
  return y;
}

/** Walk up to transport_balloon (the node that owns balloon_basket / balloon_load_frame). */
export function balloonRootOf(node:Node|null|undefined):Node|null{
  let a:Node|null|undefined=node;
  for(let i=0;a&&i<8;i++,a=a.parent){
    if(typeof a.getChildByName==='function'&&(a.getChildByName('balloon_load_frame')||a.getChildByName('balloon_basket')))return a;
  }
  return null;
}

function placeY(node:Node|null,y:number):void{
  if(!node)return;
  node.setPosition(node.position.x,y,node.position.z);
}

/**
 * Collapse or grow balloon_load_frame about the basket rim, and park the flame on the burner.
 * Missing frame (stub / pre-split asset) is a no-op. Flame local scale is left to the caller.
 */
export function poseLoadFrameFromEnvelope(envelope:Node|null|undefined,t:number):void{
  const root=balloonRootOf(envelope??null);
  if(!root)return;
  const pose=balloonDrapePose(t);
  const frame=root.getChildByName('balloon_load_frame');
  if(frame){
    frame.active=pose.frameVisible;
    if(pose.frameVisible)frame.setScale(pose.frameSxz,pose.frameSy,pose.frameSxz);
    else frame.setScale(0.001,0.001,0.001);
    frame.setPosition(0,pose.frameLocalY,0);
  }
  const flame=root.getChildByName('burner_flame');
  const burner=root.getChildByName('burner_root');
  if(flame){
    const y0=authoredY(flame);
    const y=pose.frameVisible?BALLOON_DRAPE.frameBaseY+(y0-BALLOON_DRAPE.frameBaseY)*pose.frameSy:pose.flameLocalY;
    placeY(flame,y);
  }
  if(burner){
    const y0=authoredY(burner);
    const y=pose.frameVisible?BALLOON_DRAPE.frameBaseY+(y0-BALLOON_DRAPE.frameBaseY)*pose.frameSy:pose.burnerLocalY;
    placeY(burner,y);
  }
}
