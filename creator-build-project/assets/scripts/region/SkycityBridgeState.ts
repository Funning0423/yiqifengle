import type {Node} from 'cc';
/**
 * Sky-city broken bridge. env_skycity.glb keeps both meshes as siblings under skycity_float_root.
 * The region shows only state_bridge_after. state_bridge_before stays in the tree and is not drawn.
 * The glb is not edited. In-flight balloon sky-arrival still hides state_bridge_after via BalloonFlight.ALWAYS_HIDDEN;
 * the landing handoff (BalloonTransit, t >= HANDOFF_COVER_T) calls applySkycityBridgeForBalloon(..., true).
 */
export const SKYCITY_BRIDGE_BEFORE='state_bridge_before';
export const SKYCITY_BRIDGE_AFTER='state_bridge_after';
export const SKYCITY_BRIDGE_BEFORE_PATH='skycity_float_root/state_bridge_before';
export const SKYCITY_BRIDGE_AFTER_PATH='skycity_float_root/state_bridge_after';
export function applySkycityBrokenBridge(root:Node|null):void{
  if(!root)return;
  const walk=(n:Node)=>{
    if(n.name===SKYCITY_BRIDGE_BEFORE)n.active=false;
    else if(n.name===SKYCITY_BRIDGE_AFTER)n.active=true;
    for(const c of n.children)walk(c);
  };
  walk(root);
}
/** handoff false: leave the in-flight hide list alone. handoff true: region rule after the balloon lands. */
export function applySkycityBridgeForBalloon(root:Node|null,handoff:boolean):void{
  if(handoff)applySkycityBrokenBridge(root);
}
