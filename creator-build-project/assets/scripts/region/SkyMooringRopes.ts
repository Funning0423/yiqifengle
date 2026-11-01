import type {Node} from 'cc';
/** b19 dock models (cand7): the sky-city mooring ropes (sky_mooring_props.glb) only show while a basket is moored at that
 *  post: 'landing' = sky_mooring_rope (meadow→skycity balloon from touchdown until it is gone), '5a' = sky_mooring_5a_rope
 *  (skycity→lakeside basket from the start of the ride until lift-off). Mounted props start stowed (hidden). No @ccclass. */
export type MooringSite='landing'|'5a';
export const MOORING_ROPES:Readonly<Record<MooringSite,string>>=Object.freeze({landing:'sky_mooring_rope','5a':'sky_mooring_5a_rope'});
const PROPS='sky_mooring_props';
function each(root:Node,name:string,fn:(n:Node)=>void):void{if(root.name===name)fn(root);for(const c of root.children)each(c,name,fn);}
/** Show / stow the site's rope(s) under root (a sky_mooring_props instance, a sky-city model, or the scene). Returns ropes touched. */
export function setMooringRopes(root:Node|null|undefined,site:MooringSite,moored:boolean):number{
 let k=0;try{if(!root||!root.isValid)return 0;const visit=(props:Node)=>each(props,MOORING_ROPES[site],n=>{if(n.active!==moored)n.active=moored;k++;});
  if(root.name===PROPS)visit(root);else each(root,PROPS,visit);}catch{/* props optional */}
 return k;
}
/** Change-only toggler (per frame callers). */
export function mooringToggle(site:MooringSite,root:()=>Node|null|undefined){let last:boolean|null=null;return (moored:boolean)=>{if(last===moored)return;last=moored;setMooringRopes(root(),site,moored);};}
