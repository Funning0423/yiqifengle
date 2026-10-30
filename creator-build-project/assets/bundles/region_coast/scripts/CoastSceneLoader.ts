/**
 * 海岸 A runtime scene loader (?qfcoastkit=1 only). 场景设计部 2026-10-30.
 * PRIMARY ENTRY (module export, same bundle): loadCoastScene(world, {resolveReuse, resolveMaterial, cancelled}) -> CoastSceneHandle|null.
 * Also registered as globalThis.__qfCoast.loadCoastScene / unloadCoastScene when this module is evaluated (only on the kit path:
 * the module lives in the region_coast bundle, which only the kit path loads). The single wiring point is the bundle's
 * globalThis.__qfCoast.runCoastArrival (运镜bot/GGbot): await loadCoastScene(...) FIRST, then her install -> playCoastArrival -> finally uninstall.
 *
 * No pop-in: the whole tree is built on a DETACHED, INACTIVE root; one synchronous step attaches it under the world node and activates it.
 * No silent degradation: every failure / skip / unresolved name is console.error('[QF_COAST] ...'). There is NO builtin-material fallback:
 * materials come only from opts.resolveMaterial (island/meadow material set, owned by the caller). Missing required options = error, nothing shown.
 * cancelled() is checked after every async step; a cancelled mount releases what it loaded and shows nothing.
 * dispose(): destroys every instantiated node and the coast_palette material clones, and decRefs the bundle assets this loader loaded
 * (layout + glb prefabs + coast_palette texture). Island templates
 * (resolveReuse) and caller materials (resolveMaterial) are never released or destroyed here.
 */
import { assetManager, AssetManager, Asset, instantiate, isValid, JsonAsset, Material, MeshRenderer, Node, Prefab, Texture2D } from 'cc';
import { coastBoardKitFromFlag } from '../../../scripts/ui/BoardProjection';
import { COAST_BUNDLE, COAST_LAYOUT_PATH, COAST_PALETTE_PATH, COAST_MODELS_DIR, COAST_REUSE_SOURCES, COAST_ROOT, coastInstances, type CoastLayout, type CoastInstance, type MatKind } from './CoastSceneLayout';

export const QF_COAST='[QF_COAST]';
export type CoastMaterialKey=Readonly<{mesh:string;kind:MatKind;alpha:number;emit:boolean;
  /** true: return the island's shared M_env_palette; the loader clones it and swaps mainTexture -> coast_palette (same effect/params). false: translucent/unlit coast mesh, GGbot's island material used as returned. */
  palette:boolean}>;
export type CoastSceneOptions=Readonly<{
  /** REQUIRED. name in COAST_REUSE_SOURCES -> an already-loaded island node to CLONE (the loader instantiate()s it; never mutated/released). null = unresolved (error). */
  resolveReuse:(name:string)=>Node|null;
  /** REQUIRED. coast mesh -> island/meadow Material (shared, caller-owned; never destroyed here). null = unavailable (error, mesh not mounted). */
  resolveMaterial:(key:CoastMaterialKey)=>Material|null;
  /** REQUIRED. true once the scene is torn down / region changed: the mount aborts cleanly at the next step. */
  cancelled:()=>boolean;
  deadlineMs?:number;
  /** test seam */ kitOn?:()=>boolean}>;
export type CoastSceneHandle=Readonly<{root:Node;placed:number;reusePlaced:number;errors:readonly string[];dispose():void}>;
/** world = the island scene_root node (identity frame of coast_layout.json placement), or an object carrying it. */
export type CoastWorld=Node|Readonly<{sceneRoot?:Node|null;node?:Node|null;root?:Node|null}>;

const err=(msg:string)=>{console.error(QF_COAST+' '+msg);return msg;};
const deadline=<T>(p:Promise<T>,ms:number)=>{let t:any;return Promise.race([p,new Promise<never>((_,no)=>{t=setTimeout(()=>no(Error('coast-asset-timeout')),ms);})]).finally(()=>clearTimeout(t));};
const loadBundle=()=>new Promise<AssetManager.Bundle>((ok,no)=>{const b=assetManager.getBundle?.(COAST_BUNDLE);if(b)return ok(b);assetManager.loadBundle(COAST_BUNDLE,(e,x)=>e||!x?no(e||Error('no bundle')):ok(x));});
const loadJson=(b:AssetManager.Bundle)=>new Promise<JsonAsset>((ok,no)=>b.load(COAST_LAYOUT_PATH,JsonAsset,(e,a)=>e||!a?no(e||Error('no layout')):ok(a)));
const loadTex=(b:AssetManager.Bundle)=>new Promise<Texture2D>((ok,no)=>b.load(COAST_PALETTE_PATH,Texture2D,(e,a)=>e||!a?no(e||Error('no coast_palette')):ok(a)));
const loadPrefabs=(b:AssetManager.Bundle)=>new Promise<Prefab[]>((ok,no)=>b.loadDir(COAST_MODELS_DIR,Prefab,(e,l)=>e?no(e):ok(l||[])));
function worldNode(w:CoastWorld|null|undefined):Node|null{if(!w)return null;if(w instanceof Node)return w;const o=w as any;return o.sceneRoot||o.node||o.root||null;}
function findDeep(n:Node,name:string):Node|null{if(n.name===name&&n.getComponent(MeshRenderer))return n;for(const c of n.children){const r=findDeep(c,name);if(r)return r;}return null;}
function setTRS(n:Node,i:CoastInstance){n.setPosition(i.position[0],i.position[1],i.position[2]);n.setRotationFromEuler(i.eulerDeg[0],i.eulerDeg[1],i.eulerDeg[2]);n.setScale(i.scale,i.scale,i.scale);}

export async function loadCoastScene(world:CoastWorld,opts:CoastSceneOptions):Promise<CoastSceneHandle|null>{
  if(!(opts?.kitOn??coastBoardKitFromFlag)())return null;   // flag off: no engine call, no log
  const parent=worldNode(world);
  const miss=[!parent&&'world node',typeof opts?.resolveReuse!=='function'&&'resolveReuse',typeof opts?.resolveMaterial!=='function'&&'resolveMaterial',typeof opts?.cancelled!=='function'&&'cancelled'].filter(Boolean);
  if(miss.length){err('scene not mounted: missing '+miss.join(', '));return null;}
  const ms=opts.deadlineMs??20000,held:Asset[]=[];let root:Node|null=null,lib:Node|null=null;const clones:Material[]=[];
  const release=()=>{for(const c of clones.splice(0))if(isValid(c))c.destroy();if(lib&&isValid(lib))lib.destroy();lib=null;if(root&&isValid(root))root.destroy();root=null;for(const a of held.splice(0))a.decRef();};
  const gone=()=>{if(!opts.cancelled())return false;console.warn(QF_COAST+' scene mount cancelled (teardown/region change)');release();return true;};
  try{const b=await deadline(loadBundle(),ms);if(gone())return null;
    const [json,prefabs,tex]=await Promise.all([deadline(loadJson(b),ms),deadline(loadPrefabs(b),ms*1.5),deadline(loadTex(b),ms)]);
    json.addRef();held.push(json);tex.addRef();held.push(tex);for(const p of prefabs){p.addRef();held.push(p);}if(gone())return null;
    const L=json.json as CoastLayout;root=new Node(COAST_ROOT.name);root.active=false;   // detached + inactive until the end
    root.setPosition(COAST_ROOT.position[0],COAST_ROOT.position[1],COAST_ROOT.position[2]);root.setRotationFromEuler(0,COAST_ROOT.yawDeg,0);root.setScale(COAST_ROOT.scale,COAST_ROOT.scale,COAST_ROOT.scale);
    lib=new Node('coast_glb_templates');for(const p of prefabs)lib.addChild(instantiate(p));
    const tpl=new Map<string,Node|null>(),mats=new Map<string,Material|null>(),errors:string[]=[];let placed=0,reusePlaced=0;
    for(const i of coastInstances(L)){
      let t=tpl.get(i.mesh);
      if(t===undefined){
        if(i.reuse){if(!COAST_REUSE_SOURCES[i.mesh])errors.push(err('reuse name not in COAST_REUSE_SOURCES: '+i.mesh));
          try{t=opts.resolveReuse(i.mesh);}catch(e){t=null;}if(!t||!isValid(t)){t=null;errors.push(err('reuse unresolved: '+i.mesh+' ('+(COAST_REUSE_SOURCES[i.mesh]?.count??'?')+' instances not mounted)'));}}
        else{t=findDeep(lib,i.mesh);if(!t)errors.push(err('mesh missing in models/*.glb: '+i.mesh));}
        tpl.set(i.mesh,t);}
      if(!t)continue;
      if(i.reuse){const n=instantiate(t);n.name=i.mesh;n.active=true;setTRS(n,i);root.addChild(n);reusePlaced++;continue;}   // keeps the island's own materials
      const mk=i.mesh+'|'+i.kind+'|'+i.alpha;let m=mats.get(mk);
      if(m===undefined){let base:Material|null=null;try{base=opts.resolveMaterial({mesh:i.mesh,kind:i.kind,alpha:i.alpha,emit:i.kind==='unlit',palette:i.palette});}catch(e){base=null;}
        if(!base||!isValid(base)){m=null;errors.push(err('material unavailable for '+i.mesh+' (no fallback; mesh not mounted)'));}
        else if(!i.palette)m=base;
        else{m=paletteClone(base,tex,clones);if(!m)errors.push(err('coast_palette swap failed on '+(base.name||'?')+': property '+COAST_MAIN_TEXTURE+' missing / setProperty threw / read-back mismatch (mesh '+i.mesh+' not mounted, island colours never shown)'));}
        mats.set(mk,m);}
      if(!m)continue;
      const n=instantiate(t);n.name=i.mesh;setTRS(n,i);const r=n.getComponent(MeshRenderer);
      if(r){r.setMaterial(m,0);r.shadowCastingMode=i.castShadow?1:0;r.receiveShadow=i.receiveShadow?1:0;}
      root.addChild(n);placed++;}
    lib.destroy();lib=null;
    if(gone())return null;
    if(!isValid(parent!)){err('scene not mounted: world node destroyed');release();return null;}
    const shown=root;parent!.addChild(shown);shown.active=true;root=null;   // single synchronous show
    const mine=held.splice(0),mineMats=clones.splice(0);let done=false;
    const handle:CoastSceneHandle={root:shown,placed,reusePlaced,errors,dispose(){if(done)return;done=true;if(isValid(shown))shown.destroy();for(const c of mineMats)if(isValid(c))c.destroy();for(const a of mine)a.decRef();}};
    return handle;
  }catch(e){err('scene mount failed: '+String((e as any)?.message??e));release();return null;}}

/** One clone per island base material: same effect, technique, defines, states and every property (lighting/shading identical);
 *  only mainTexture becomes coast_palette. The island material itself is never modified. */
/** Property name of the base-colour texture on the island's M_env_palette effect - CONFIRM ON THE MAC (MAC_STEPS). */
export const COAST_MAIN_TEXTURE='mainTexture';
const cloneCache=new WeakMap<Material,Material>();
function paletteClone(base:Material,tex:Texture2D,owned:Material[]):Material|null{
  const hit=owned.find(c=>cloneCache.get(base)===c);if(hit)return hit;
  if(!base.passes?.length||!base.passes.some(p=>p.getHandle(COAST_MAIN_TEXTURE)))return null;
  const m=new Material();
  try{m.copy(base);m.setProperty(COAST_MAIN_TEXTURE,tex);}catch(e){m.destroy();return null;}
  let back:unknown=null;try{back=m.getProperty(COAST_MAIN_TEXTURE);}catch(e){back=null;}   // read back: the swap must have taken effect
  if(back!==tex){m.destroy();return null;}
  cloneCache.set(base,m);owned.push(m);return m;}
export function unloadCoastScene(h:CoastSceneHandle|null|undefined){h?.dispose();}

// self-registration (module evaluation = region_coast bundle loaded = kit path). Merges, never replaces, the bundle's __qfCoast object.
{const g=globalThis as any;const o=g.__qfCoast||(g.__qfCoast={});o.loadCoastScene=loadCoastScene;o.unloadCoastScene=unloadCoastScene;}
