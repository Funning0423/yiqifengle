/**
 * 海岸 A runtime scene loader (?qfcoastkit=1 only). 场景设计部 2026-10-30.
 * Lives in the region_coast subpackage: this module is only evaluated after that bundle is loaded, which only happens on the
 * kit path, so with the flag off no code here runs and every pinned file stays byte-identical.
 *
 * No pop-in contract: mountCoastScene() builds the whole tree on a DETACHED, INACTIVE root (nothing is in any scene while
 * loading/instantiating), then in one synchronous step adds it under `parent` and activates it. The caller awaits it BEFORE
 * playCoastArrival(); runCoastArrivalWithScene() is that ordered sequence (bundle -> layout + glbs -> build -> show -> camera).
 * On any failure the half-built root is destroyed (never shown) and the arrival still plays (warned, like the arrival hook).
 * reuse:true entries (island exterior props) are not in this bundle: they go through deps.resolveReuse or are skipped + counted.
 */
import { assetManager, AssetManager, Color, instantiate, isValid, JsonAsset, Material, MeshRenderer, Node, Prefab } from 'cc';
import { coastBoardKitFromFlag } from '../../../scripts/ui/BoardProjection';
import { COAST_BUNDLE, COAST_LAYOUT_PATH, COAST_MODELS_DIR, COAST_ROOT, coastInstances, type CoastLayout, type CoastInstance } from './CoastSceneLayout';
import { playCoastArrival, installCoastArrivalHer, createCoastReuseResolver, type CoastArrivalDeps } from './CoastArrivalLens';
import { director } from 'cc';

export type CoastMountResult=Readonly<{root:Node|null;placed:number;skippedReuse:number;missing:string[];reason?:string}>;
export type CoastMountDeps=Readonly<{parent:Node;deadlineMs?:number;resolveReuse?:(mesh:string)=>Node|null;
  /** test seam: defaults to the real engine calls */
  kitOn?:()=>boolean}>;

const deadline=<T>(p:Promise<T>,ms:number)=>{let t:any;return Promise.race([p,new Promise<never>((_,no)=>{t=setTimeout(()=>no(Error('coast-asset-timeout')),ms);})]).finally(()=>clearTimeout(t));};
const loadBundle=()=>new Promise<AssetManager.Bundle>((ok,no)=>assetManager.loadBundle(COAST_BUNDLE,(e,b)=>e||!b?no(e||Error('no bundle')):ok(b)));
const loadJson=(b:AssetManager.Bundle)=>new Promise<JsonAsset>((ok,no)=>b.load(COAST_LAYOUT_PATH,JsonAsset,(e,a)=>e||!a?no(e||Error('no layout')):ok(a)));
const loadPrefabs=(b:AssetManager.Bundle)=>new Promise<Prefab[]>((ok,no)=>b.loadDir(COAST_MODELS_DIR,Prefab,(e,l)=>e?no(e):ok(l||[])));

const mats=new Map<string,Material>();
function coastMaterial(kind:'std'|'unlit',alpha:number):Material{const key=kind+alpha;let m=mats.get(key);if(m)return m;m=new Material();
  m.initialize({effectName:kind==='unlit'?'builtin-unlit':'builtin-standard',technique:alpha<1?1:0,defines:{USE_VERTEX_COLOR:true}});
  if(kind==='std'){m.setProperty('roughness',0.88);m.setProperty('metallic',0);m.setProperty('mainColor',new Color(255,255,255,255));}
  mats.set(key,m);return m;}
function findDeep(n:Node,name:string):Node|null{if(n.name===name&&n.getComponent(MeshRenderer))return n;for(const c of n.children){const r=findDeep(c,name);if(r)return r;}return null;}

function place(root:Node,tpl:Node,i:CoastInstance){const n=instantiate(tpl);n.name=i.mesh;n.setPosition(i.position[0],i.position[1],i.position[2]);
  n.setRotationFromEuler(i.eulerDeg[0],i.eulerDeg[1],i.eulerDeg[2]);n.setScale(i.scale,i.scale,i.scale);
  const r=n.getComponent(MeshRenderer);if(r){r.setMaterial(coastMaterial(i.kind,i.alpha),0);r.shadowCastingMode=i.castShadow?1:0;r.receiveShadow=i.receiveShadow?1:0;}
  root.addChild(n);}

/** Builds the coast tree hidden and shows it in one step. Flag off: returns immediately, touches nothing. */
export async function mountCoastScene(deps:CoastMountDeps):Promise<CoastMountResult>{
  if(!(deps.kitOn??coastBoardKitFromFlag)())return {root:null,placed:0,skippedReuse:0,missing:[],reason:'kit-off'};
  const ms=deps.deadlineMs??20000;let root:Node|null=null;
  try{const b=await deadline(loadBundle(),ms);const [json,prefabs]=await Promise.all([deadline(loadJson(b),ms),deadline(loadPrefabs(b),ms*1.5)]);
    const L=json.json as CoastLayout;root=new Node(COAST_ROOT.name);root.active=false;   // detached + inactive until the end
    root.setPosition(COAST_ROOT.position[0],COAST_ROOT.position[1],COAST_ROOT.position[2]);root.setRotationFromEuler(0,COAST_ROOT.yawDeg,0);root.setScale(COAST_ROOT.scale,COAST_ROOT.scale,COAST_ROOT.scale);
    const lib=new Node('coast_glb_templates');for(const p of prefabs)lib.addChild(instantiate(p));
    const tpl=new Map<string,Node|null>();let placed=0,skippedReuse=0;const missing:string[]=[];
    for(const i of coastInstances(L)){
      let t=tpl.get(i.mesh);if(t===undefined){t=i.reuse?(deps.resolveReuse?.(i.mesh)??null):findDeep(lib,i.mesh);tpl.set(i.mesh,t);}
      if(!t||!isValid(t)){if(i.reuse)skippedReuse++;else if(!missing.includes(i.mesh))missing.push(i.mesh);continue;}
      place(root,t,i);placed++;}
    lib.destroy();
    if(!isValid(deps.parent))throw Error('parent gone');
    deps.parent.addChild(root);root.active=true;   // single synchronous show: whole coast appears in the same frame
    if(missing.length)console.error('[QF_COAST] scene: missing meshes',missing.join(','));
    return {root,placed,skippedReuse,missing};
  }catch(e){if(root&&isValid(root))root.destroy();console.error('[QF_COAST] scene mount skipped',String((e as any)?.message??e));
    return {root:null,placed:0,skippedReuse:0,missing:[],reason:String((e as any)?.message??e)};}}

/** The ordered kit-on sequence for the arrival hook: scene fully built and shown BEFORE the first camera write. */
export async function runCoastArrivalWithScene(arrival:CoastArrivalDeps,scene:CoastMountDeps){
  const s=await mountCoastScene(scene);const a=await playCoastArrival(arrival);return {scene:s,arrival:a};}
/* ---- GGbot: the ONE kit-on entry (contract: globalThis.__qfCoast.runCoastArrival(world,{resolveReuse,cancelled})).
 * Registered when this bundle script is evaluated, i.e. only after assetManager.loadBundle('region_coast') on the kit path —
 * no main-package import of bundle scripts. world = WorldFlowComponent (worldCamera, node, scheduleOnce).
 * Order: loadCoastScene (mountCoastScene) -> installCoastArrivalHer -> playCoastArrival -> uninstall in finally. Errors: console.error [QF_COAST]. */
export type CoastEntryOpts=Readonly<{resolveReuse?:(mesh:string)=>Node|null;cancelled?:()=>boolean}>;
export async function runCoastArrival(world:any,opts:CoastEntryOpts={}):Promise<{ok:boolean;reason?:string;scene?:CoastMountResult}>{
 let off:(()=>void)|null=null;
 try{const cam=world?.worldCamera,parent=world?.node;if(!cam?.node?.isValid||!parent?.isValid){console.error('[QF_COAST] arrival: world camera/node missing');return {ok:false,reason:'no-world'};}
  const cancelled=()=>!!opts.cancelled?.()||!parent.isValid;
  const scene=await mountCoastScene({parent,resolveReuse:(opts.resolveReuse??createCoastReuseResolver(world)) as any});
  if(!scene.root)console.error('[QF_COAST] arrival: coast scene not mounted ('+(scene.reason??'?')+')');
  if(scene.skippedReuse||scene.missing.length)console.error('[QF_COAST] arrival: scene incomplete: reuse skipped '+scene.skippedReuse+', missing '+scene.missing.join(','));
  if(cancelled())return {ok:false,reason:'cancelled',scene};
  off=installCoastArrivalHer(world);
  const r=await playCoastArrival({camera:cam,viewport:()=>({width:window.innerWidth,height:window.innerHeight}),cancelled,
   nextFrame:()=>new Promise<number>(res=>world.scheduleOnce(()=>res(director.getDeltaTime()),0)),her:(f)=>world.coastArrivalHer?.(f)});
  return {ok:r.ok,reason:r.ok?undefined:'cancelled',scene};
 }catch(e){console.error('[QF_COAST] arrival failed',String((e as any)?.message??e));return {ok:false,reason:String((e as any)?.message??e)};}
 finally{try{off?.();}catch(e){console.error('[QF_COAST] arrival uninstall',String(e));}}}
try{const g:any=globalThis;g.__qfCoast=Object.freeze({...(g.__qfCoast||{}),runCoastArrival});}catch(e){console.error('[QF_COAST] entry register failed',String(e));}
