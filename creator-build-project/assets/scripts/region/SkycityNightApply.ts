/** b16: applies SkycityNightGrade to a live sky-city copy (board lease or the balloon journey's city). Only the self-lit
 *  materials (M_sky_cloud, M_sky_palette_emissive) and the board key light are touched; lit materials follow the lights.
 *  Material instances rebind their maps first (getMaterialInstance alone drops the glTF albedo and flashes magenta). */
import {Color,MeshRenderer,Node,SphereLight,Vec3,isValid} from 'cc';
import {skycityNightKind,skycityNightScale} from './SkycityNightGrade';
const MAPS=['mainTexture','albedoMap','metallicRoughnessMap','normalMap','emissiveMap'];
type Home={scale:Vec3;albedo:Vec3};
const homes=new WeakMap<MeshRenderer,Map<number,Home>>();
const lastW=new WeakMap<Node,number>();
function readScale(v:any):Vec3{if(typeof v==='number')return new Vec3(v,v,v);if(v&&typeof v.x==='number')return new Vec3(v.x,v.y,v.z);return new Vec3(1,1,1);}
const SOFT='SkycityCloudseaSoft';
/** Walks root; the soft cloud sea sibling (SOFT) is skipped unless it is the root (it is graded as sea, not ground). */
function walk(n:Node,f:(n:Node)=>void,top=true){if(!top&&n.name===SOFT)return;f(n);for(const c of n.children)walk(c,f,false);}
/** Grades every self-lit sky-city material under root to night weight w. Cheap when w did not change (returns false). */
export function gradeSkycityNight(root:Node|null,w:number,force=false,inCloudsea=false):boolean{
 if(!root||!isValid(root,true))return false;
 const k=Math.round(Math.max(0,Math.min(1,Number.isFinite(w)?w:0))*1000)/1000;if(!force&&lastW.get(root)===k)return false;lastW.set(root,k);
 const s=skycityNightScale(k);
 walk(root,n=>{for(const r of n.getComponents(MeshRenderer)){const shared=r.sharedMaterials;
  for(let i=0;i<shared.length;i++){const sm=shared[i];const kind=skycityNightKind(sm?.name,n.name,inCloudsea);if(!sm||!kind)continue;
   let h=homes.get(r);if(!h){h=new Map();homes.set(r,h);}
   if(!h.has(i)){let base:any=null,alb:any=null;try{base=sm.getProperty('emissiveScale');}catch{/* */}try{alb=sm.getProperty('albedoScale');}catch{/* */}h.set(i,{scale:readScale(base),albedo:readScale(alb)});}
   if(k===0&&!(r as any).__qfSkyNight)continue;// day and never graded: leave the shared material (no instance, no DC change)
   const m=r.getMaterialInstance(i);if(!m)continue;(r as any).__qfSkyNight=true;
   for(const key of MAPS){try{const t=sm.getProperty(key);if(t!=null)m.setProperty(key,t);}catch{/* slot absent */}}
   const home=h.get(i)!,b=home.scale,a=home.albedo;
   if(kind==='cloud'||kind==='lamp'){const f=kind==='cloud'?s.cloud:[s.lamp,s.lamp,s.lamp];try{m.setProperty('emissiveScale',new Vec3(b.x*f[0],b.y*f[1],b.z*f[2]));}catch{/* */}}
   // albedo: lit ground follows the meadow night grade (ambient is not dimmed outdoors); lamps keep their albedo.
   const g=kind==='ground'||kind==='cloud'?s.ground:kind==='prop'?[s.prop,s.prop,s.prop]:kind==='sea'?s.sea:null;
   if(g){try{m.setProperty('albedoScale',new Vec3(a.x*g[0],a.y*g[1],a.z*g[2]));}catch{/* */}}
  }}});
 return true;}
const keyHome=new WeakMap<SphereLight,{lum:number;color:Color}>();
/** The soft cloud sea is a sibling of the city (SkycityCloudsea), graded as cloud sea. */
export function gradeSkycityCloudsea(parent:Node|null,w:number):boolean{const soft=parent&&isValid(parent,true)?parent.getChildByName(SOFT):null;return gradeSkycityNight(soft,w,false,true);}
/** Board key light (SkycityBackgroundKey) follows the island night: luminance x0.35 and the moon colour at w=1. */
export function gradeSkycityKeyLight(light:SphereLight|null,w:number):void{
 if(!light||!isValid(light,true))return;let h=keyHome.get(light);if(!h){h={lum:light.luminance,color:light.color?new Color(light.color.r,light.color.g,light.color.b,255):new Color(255,255,255,255)};keyHome.set(light,h);}
 const s=skycityNightScale(w);light.luminance=h.lum*s.key;
 light.color=new Color(Math.round(h.color.r*s.keyColor[0]/255),Math.round(h.color.g*s.keyColor[1]/255),Math.round(h.color.b*s.keyColor[2]/255),255);}
