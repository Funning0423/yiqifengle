import {Node,isValid} from 'cc';
/** b17 night lakeside blocker (Mac diag 5095dfe2 @ 21.5 s): leftovers of earlier legs that must not draw on the skycity→lakeside
 *  leg once she has boarded (under the full black). [parent scope, node name]: only a node named `name` with an ancestor named
 *  `scope` is hidden. env_cloud_layer (island room, kept on at night by SkycityCloudsea.syncDay b16 P1-2) wrapped the lakeside
 *  camera in a dark-blue unlit shell. SailArt/sea_plane is owned by 运镜bot (cine 1c5adec5). The skycity's own nodes are left untouched. */
export const LAKESIDE_LEG_HIDE:ReadonlyArray<readonly [string,string]>=[['room_no_original_chair','env_cloud_layer']];
export class LakesideLegHide{
  private saved=new Map<Node,boolean>();
  /** b17r13: set by SkycityCloudsea. If it has already day/night-hidden a node, returns the active state it saved, else undefined.
   *  Both hide the island env_cloud_layer (01892b6e night hide + this leg hide); without this the second hider would save `false`
   *  and its restore would leave the layer off for good. */
  static ownerSaved:((n:Node)=>boolean|undefined)|null=null;
  /** Hide every match (re-applied each frame: syncDay/restoreDay may turn them back on). */
  apply(scene:Node|null){
    if(!scene)return;
    const walk=(n:Node,scopes:string[])=>{
      for(let i=0;i<LAKESIDE_LEG_HIDE.length;i++){const scope=LAKESIDE_LEG_HIDE[i][0],name=LAKESIDE_LEG_HIDE[i][1];if(n.name===name&&scopes.indexOf(scope)>=0){if(!this.saved.has(n)){const o=LakesideLegHide.ownerSaved?.(n);this.saved.set(n,o===undefined?n.active:o);}if(n.active)n.active=false;}}
      const next=LAKESIDE_LEG_HIDE.some(([s])=>s===n.name)?scopes.concat(n.name):scopes;
      for(const c of n.children)walk(c,next);
    };
    walk(scene,[]);
  }
  /** Journey release: put back what this leg hid. */
  restore(){this.saved.forEach((active,n)=>{if(isValid(n,true)&&LakesideLegHide.ownerSaved?.(n)===undefined)n.active=active;}/* still held by SkycityCloudsea: its restoreDay puts it back */);this.saved.clear();}
}
