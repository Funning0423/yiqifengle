/** Pure geometry for the staged walks (no cc). Uses TRANSITION_STAGING values (placeholders for 场景设计部). */
import type {Vec} from '../world-r1/WorldFlowCore';
import {SAIL_I6} from './TransportLeg';
import {TRANSITION_STAGING as S} from './TransitionStaging';
/** Island pier (SAIL_I6 → toward the deck point) and both gangplanks. */
export function sailStaging(start:Vec,deck:Vec,port:Vec,step:Vec){
 const P=S.islandPier,y=P.walkY??start[1],root:Vec=[SAIL_I6[0]+P.rootOffset[0],y,SAIL_I6[2]+P.rootOffset[2]];
 const dx=deck[0]-root[0],dz=deck[2]-root[2],L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L;
 const endM=Math.max(0.2,L-P.endShortM),pierEnd:Vec=[root[0]+ux*endM,y,root[2]+uz*endM];
 const inset=Math.min(S.islandGangplank.deckInsetM,L*.5),deckEdge:Vec=[deck[0]-ux*inset,deck[1],deck[2]-uz*inset];
 const plankMid:Vec=[(port[0]+step[0])/2,(port[1]+step[1])/2+S.meadowGangplank.midLiftM,(port[2]+step[2])/2];
 return {pierRoot:root,pierEnd,deckEdge,plankMid,startToPierM:Math.hypot(root[0]-start[0],root[2]-start[2])};
}
/** Basket local → world (yaw about +Y, degrees) for the balloon door staging. */
export function basketToWorld(origin:Vec,yawDeg:number,local:Vec):Vec{const r=yawDeg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
 return [origin[0]+c*local[0]+s*local[2],origin[1]+local[1],origin[2]-s*local[0]+c*local[2]];}
