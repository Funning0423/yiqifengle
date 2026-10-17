/** 彩虹桥 r5 (GGbot): mounts the runtime-built bridge for a journey leg — replaces the 7 flat RainbowBridgeStrip* ribbons (7 DC,
 *  builtin-standard, square ends) of RegionJourneyAdapter.rainbowBridge(). Geometry and look numbers: RainbowBridgeMesh.ts.
 *  Draw calls: deck 1 (RainbowBridgeDeck) + both ends' ground halo/petals/flowers 1 (RainbowBridgeEnds) + all motes 1
 *  (RainbowBridgeMotes) = 3 (was 7). Effects: resources/world/rainbow-bridge(.effect|-additive.effect), loaded once and kept.
 *  If they cannot load, one [QF_RAINBOW] error line and a plain one-colour deck (same mesh) — the walk never waits on art. */
import {_decorator,Color,Component,EffectAsset,Material,Mesh,MeshRenderer,Node,Vec3,Vec4,resources,utils} from 'cc';
import {uiNightWeight} from '../ui/NightTint';
import {RAINBOW_GROUND} from './RainbowBridgeGround';
import {RAINBOW_LOOK,groundFromTable,rainbowDeckGeometry,rainbowGroundGeometry,rainbowLook,rainbowMotesGeometry,type RainbowEnd,type RainbowGeometry,type Vec} from './RainbowBridgeMesh';
const {ccclass}=_decorator;
export const RAINBOW_BRIDGE_EFFECTS={deck:'world/rainbow-bridge',ends:'world/rainbow-bridge-additive'} as const;
/** The island path ends at the cliff edge (ground falls away 0.2–1.5 m under the first 3 m of deck), so the island end lays a
 *  0.8 m tongue back onto the level ground and dissolves there. The meadow / lakeside ends land flat (sin² arch) and need none. */
export const RAINBOW_TONGUE_M={island:.8,meadow:0,lakeside:0} as const;
export type RainbowEndId=keyof typeof RAINBOW_TONGUE_M;
let effects:Promise<{deck:EffectAsset;ends:EffectAsset}>|null=null;
function loadEffect(path:string):Promise<EffectAsset>{return new Promise((ok,fail)=>resources.load(path,EffectAsset,(error:Error|null,fx:EffectAsset|null)=>error||!fx?fail(error||Error('rainbow-bridge-effect-missing:'+path)):ok(fx)));}
export function loadRainbowBridgeEffects():Promise<{deck:EffectAsset;ends:EffectAsset}>{
 if(!effects){const p=Promise.all([loadEffect(RAINBOW_BRIDGE_EFFECTS.deck),loadEffect(RAINBOW_BRIDGE_EFFECTS.ends)]).then(([deck,ends])=>{deck.addRef();ends.addRef();return {deck,ends};});
  effects=p;p.catch(()=>{if(effects===p)effects=null;});}
 return effects;
}
/** A real bridge end with its baked ground (RainbowBridgeGround) — `end` is the path point, `avoid` her walk next to it. */
export function rainbowEnd(id:RainbowEndId,end:Vec,avoid:readonly Vec[]=[]):RainbowEnd{
 const t=RAINBOW_GROUND[id];
 if(t.frame==='world'&&Math.hypot(end[0]-t.at[0],end[2]-t.at[2])>.3)try{console.warn('[QF_RAINBOW] '+id+' end moved '+JSON.stringify(end)+' vs baked '+JSON.stringify(t.at)+'; rerun tools/rainbow-bridge/bake-ground.cjs');}catch{}
 return {...groundFromTable(t,end),tongueM:RAINBOW_TONGUE_M[id],cap:true,avoid};
}
@ccclass('RainbowBridgeLook')
export class RainbowBridgeLook extends Component{
 deck:Material|null=null;ends:Material[]=[];private last=-1;
 update(){this.apply(uiNightWeight());}
 /** night weight 0..1 → deck rbParams0 / ends endParams (RAINBOW_LOOK); only written when it changes. */
 apply(night:number){const w=Math.max(0,Math.min(1,Number.isFinite(night)?night:0));if(Math.abs(w-this.last)<1e-3)return;this.last=w;const L=rainbowLook(w);
  this.deck?.setProperty('rbParams0',new Vec4(L.deck[0],L.deck[1],L.deck[2],L.deck[3]));for(const m of this.ends)m.setProperty('endParams',new Vec4(L.ends[0],L.ends[1],L.ends[2],L.ends[3]));}
}
function meshOf(g:RainbowGeometry):Mesh{
 return utils.createMesh({positions:g.positions,normals:g.normals,uvs:g.uvs,colors:g.colors,indices:g.indices,minPos:new Vec3(g.minPos.x,g.minPos.y,g.minPos.z),maxPos:new Vec3(g.maxPos.x,g.maxPos.y,g.maxPos.z)});
}
function attach(parent:Node,name:string,mesh:Mesh,material:Material,owned:Array<Mesh|Material>):Node{
 const node=new Node(name);parent.addChild(node);const r=node.addComponent(MeshRenderer);r.mesh=mesh;r.setSharedMaterial(material,0);owned.push(mesh,material);return node;
}
/** Mounts the bridge under `parent` (the journey rig). ends[0] = path start, ends[1] = path end (null = no cap, anchor-level ride;
 *  sky city until plan B §8.4 lands). Everything created is pushed to `owned` (the lease destroys it). */
export async function mountRainbowBridge(parent:Node,path:readonly Vec[],owned:Array<Mesh|Material>,ends:readonly [RainbowEnd|null,RainbowEnd|null]=[null,null]):Promise<{drawCalls:number;particles:number}>{
 const deck=rainbowDeckGeometry(path,ends);
 let fx:{deck:EffectAsset;ends:EffectAsset}|null=null;
 try{fx=await loadRainbowBridgeEffects();}catch(error){try{console.error('[QF_RAINBOW] bridge effects unavailable, plain deck: '+String(error));}catch{}}
 if(!fx){const m=new Material();m.initialize({effectName:'builtin-standard',defines:{USE_VERTEX_COLOR:false}});m.setProperty('mainColor',new Color('#d9d2ee'));m.setProperty('roughness',.9);
  attach(parent,'RainbowBridgeDeck',meshOf(deck),m,owned);return {drawCalls:1,particles:0};}
 const deckMat=new Material();deckMat.initialize({effectAsset:fx.deck});const F=RAINBOW_LOOK.flow;deckMat.setProperty('rbParams1',new Vec4(F.speedMps,F.periodM,F.streak,F.sparkle));
 attach(parent,'RainbowBridgeDeck',meshOf(deck),deckMat,owned);
 const look=parent.getComponent(RainbowBridgeLook)||parent.addComponent(RainbowBridgeLook);look.deck=deckMat;look.ends=[];let drawCalls=1,particles=0;
 const ground=rainbowGroundGeometry(path,ends);
 if(ground.indices.length){const m=new Material();m.initialize({effectAsset:fx.ends,technique:0});attach(parent,'RainbowBridgeEnds',meshOf(ground),m,owned);look.ends.push(m);drawCalls++;}
 const motes=rainbowMotesGeometry(path,ends,deck);
 if(motes.indices.length){const m=new Material();m.initialize({effectAsset:fx.ends,technique:1});attach(parent,'RainbowBridgeMotes',meshOf(motes),m,owned);look.ends.push(m);drawCalls++;particles=motes.count.total;}
 look.apply(uiNightWeight());
 try{if((globalThis as any).__worldFlowLog)console.info('[QF_RAINBOW] '+JSON.stringify({rings:deck.rings,deckTris:deck.indices.length/3,endTris:ground.indices.length/3,particles,drawCalls}));}catch{}
 return {drawCalls,particles};
}
