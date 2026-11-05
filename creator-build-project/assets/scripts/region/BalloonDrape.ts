import type {Node} from 'cc';
import {INFLATE, inflateAt} from './TransitionChain';

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
 * until the throat is wide enough for the cables to meet the mouth. At t = INFLATE.durationS
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
  flatSy:0.16,
  flatSxz:0.34,
  /** horizontal scale follows the vertical rise so the bubble stays round */
  roundFollow:0.75,
  /** balloon_load_frame bounds in transport_balloon space (split from balloon_basket) */
  frameBaseY:1.096175,
  frameTopY:3.071971,
  flameHomeY:2.625,
  burnerHomeY:2.62,
  /** hide the frame until the throat can cover the cable tops (mouth radius ≈ 0.62) */
  frameShowSxz:0.58,
});

export type BalloonDrapePose={
  sy:number;sxz:number;mouthY:number;crownY:number;
  frameVisible:boolean;frameSy:number;frameSxz:number;frameLocalY:number;
  flameLocalY:number;burnerLocalY:number;
};

export function balloonDrapePose(t:number):BalloonDrapePose{
  const I=INFLATE,f=inflateAt(t),D=BALLOON_DRAPE;
  const uY=(f.sy-I.flatY)/(1-I.flatY),uX=(f.sxz-I.flatXZ)/(1-I.flatXZ);
  const sy=D.flatSy+(1-D.flatSy)*uY;
  const uSxz=uX>1?uX:Math.max(uX,Math.min(1,Math.max(0,uY))*D.roundFollow);
  const sxz=D.flatSxz+(1-D.flatSxz)*uSxz;
  const mouthY=uY>=1?D.mouthFullY:D.mouthFlatY+(D.mouthFullY-D.mouthFlatY)*Math.max(0,uY);
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
