/** 风云擦除 (WindWipe, UI设计部 ui/post-island-ui 9fe06160 SPEC §1): the one shared transition cover. A warm low-poly cloud
 *  band sweeps from lower-left to upper-right (12° tilt) in the wind direction: OUT 0.45 s smoothstep, HOLD ≥ 1.10 s (until the
 *  next scene is loaded and she / the camera are placed), IN 0.55 s continuing to upper-right (never backs off). During HOLD only
 *  one 3D vehicle shows (no region sign since the region-title SPEC); no buttons, no other text. Pure (no cc imports): the geometry and the orchestration
 *  live here so tests can drive simulated time; ui/WindWipe.ts draws it and WorldIntegrationBoot owns the node.
 *
 *  Legacy API: every cover caller speaks `cover(alpha, seconds)` (ScreenCover). WindWipeState maps that onto the band: a rising
 *  alpha is OUT progress (the band's leading edge sweeps in), a falling alpha is IN progress (its trailing edge sweeps out the
 *  far side). The band never draws black: alpha 1 is an opaque warm (day) / deep-blue starry (night) cloud field. */
export const WINDWIPE={outS:.45,holdS:1.10,inS:.55,homeHoldS:.5,tiltDeg:12,lobes:26,lobeMinPt:36,lobeMaxPt:70,
  contentInDelayS:.3,contentFadeS:.3,contentOutS:.2,driftPtS:22,bobPt:5,bobRad:2.6,dotsAfterS:3,maxHoldS:20} as const;
export const WINDWIPE_COLORS={
  day:{top:[0xff,0xf6,0xe2],bottom:[0xfc,0xe4,0xba],facet:[0xff,0xfc,0xf4],facetA:.27,stars:0},
  night:{top:[0x28,0x32,0x52],bottom:[0x3e,0x46,0x68],facet:[0xff,0xfc,0xf4],facetA:.09,stars:40,star:[0xff,0xe2,0xa0]},
} as const;
export type WipeVehicle='sailboat'|'balloon'|'chime';
export interface WipeContent{vehicle:WipeVehicle|null;sign:string|null}
/** Destination → hold content (SPEC §2 TR1/TR3/TR9; TR8 home has none). */
/** Region-title SPEC §1 (UI设计部 00bae3e7): no place-name sign or any text during a transition; the name now fades in at the
 *  first level of a new region (ui/RegionArrivalTitle.ts). `sign` is always null; the hold keeps only the 3D vehicle. */
export function wipeContentFor(to:string|null|undefined,ride?:boolean):WipeContent{
  if(to==='meadow')return {vehicle:'sailboat',sign:null};
  if(to==='skycity'||to==='lakeside')return {vehicle:'balloon',sign:null};
  if(to==='ending')return {vehicle:'chime',sign:null};
  if(to==='island')return {vehicle:null,sign:null};
  return {vehicle:ride?'balloon':null,sign:null};
}
export const smoothstep=(t:number)=>{const x=Math.max(0,Math.min(1,Number.isFinite(t)?t:0));return x*x*(3-2*x);};
/** Band edges along the wind axis, in units where 0 = the screen's lower-left extreme and 1 = its upper-right extreme
 *  (the projection of the screen corners on the tilted wind direction). `lead`: everything with s < lead is cloud;
 *  `trail`: everything with s < trail is clear again. LOBE is the edge depth (lobes stick out of the straight edge), so
 *  lead ≥ 1+LOBE covers every pixel and trail ≥ 1+LOBE clears every pixel. */
export const LOBE=.16;
export type WipeMode='clear'|'out'|'full'|'in';
export interface WipeShape{mode:WipeMode;lead:number;trail:number;opaque:boolean;coverage:number}
export function wipeShape(mode:WipeMode,progress:number):WipeShape{
  const p=smoothstep(progress),span=1+2*LOBE;
  if(mode==='clear')return {mode,lead:-LOBE,trail:-LOBE,opaque:false,coverage:0};
  if(mode==='full')return {mode,lead:1+LOBE,trail:-LOBE,opaque:true,coverage:1};
  if(mode==='out'){const lead=-LOBE+span*p;return {mode,lead,trail:-LOBE,opaque:p>=1,coverage:Math.max(0,Math.min(1,lead))};}
  const trail=-LOBE+span*p;return {mode,lead:1+LOBE,trail,opaque:p<=0,coverage:Math.max(0,Math.min(1,1-trail))};
}
/** Screen point (x right, y up, origin centre, w×h) → wind-axis coordinate s (0 lower-left extreme … 1 upper-right extreme). */
export function windAxis(w:number,h:number,tiltDeg:number=WINDWIPE.tiltDeg){
  // the band travels along d, 12° above horizontal (lower-left → upper-right); its edge is perpendicular to d
  const a=tiltDeg*Math.PI/180,d=[Math.cos(a),Math.sin(a)];
  const ext=Math.abs(d[0])*w/2+Math.abs(d[1])*h/2;
  return {dir:d,ext,s:(x:number,y:number)=>((x*d[0]+y*d[1])/ext+1)/2,at:(s:number)=>(2*s-1)*ext};
}
/** Edge lobes (deterministic): `count` circles of radius r along the edge line, offsets along the edge in [-1,1]. */
export function wipeLobes(count:number=WINDWIPE.lobes,seed=7):{u:number;r:number;bulge:number}[]{
  const out:{u:number;r:number;bulge:number}[]=[];let x=seed>>>0||1;const rnd=()=>{x^=x<<13;x>>>=0;x^=x>>17;x^=x<<5;x>>>=0;return (x%10000)/10000;};
  for(let i=0;i<count;i++){const r=WINDWIPE.lobeMinPt+(WINDWIPE.lobeMaxPt-WINDWIPE.lobeMinPt)*rnd();out.push({u:-1.05+2.1*(i+.5)/count,r,bulge:.35+.4*rnd()});}
  return out;
}
/** Maps the legacy cover(alpha, seconds) ramps onto WindWipe phases. */
export class WindWipeState{
  mode:WipeMode='clear';private from=0;private to=0;private at=0;private s=0;progress=0;fullSince=-1;
  /** Returns the ramp's direction ('out' rising, 'in' falling, or 'none'). */
  set(alpha:number,seconds:number,now:number):'out'|'in'|'none'{
    const a=Math.max(0,Math.min(1,Number.isFinite(alpha)?alpha:0)),cur=this.alpha();
    this.from=cur;this.to=a;this.at=now;this.s=Math.max(0,seconds||0);
    if(a>cur+1e-6){if(this.mode!=='out'){this.mode='out';}return 'out';}
    if(a<cur-1e-6){if(this.mode!=='in'){this.mode='in';}return 'in';}
    return 'none';
  }
  /** Current cover alpha (0 clear … 1 full). */
  alpha():number{return this.mode==='clear'?0:this.mode==='full'?1:this.mode==='out'?this.progress:1-this.progress;}
  /** Advance to `now`; returns true when the active ramp has finished. */
  tick(now:number):boolean{
    const t=this.s>0?Math.min(1,Math.max(0,(now-this.at)/this.s)):1,a=this.from+(this.to-this.from)*t;
    if(this.mode==='out')this.progress=a;else if(this.mode==='in')this.progress=1-a;
    if(t>=1){if(a>=1-1e-6){if(this.mode!=='full')this.fullSince=now;this.mode='full';this.progress=1;}else if(a<=1e-6){this.mode='clear';this.progress=0;this.fullSince=-1;}}
    return t>=1;
  }
  shape():WipeShape{return wipeShape(this.mode,this.mode==='out'||this.mode==='in'?this.progress:this.mode==='full'?1:0);}
}
/** Hold content alpha: fades in contentFadeS after `contentInDelayS` of full cover, out over contentOutS once IN starts. */
export function contentAlpha(state:{mode:WipeMode;fullFor:number;inFor:number}):number{
  if(state.mode==='full')return smoothstep((state.fullFor-WINDWIPE.contentInDelayS)/WINDWIPE.contentFadeS);
  if(state.mode==='in')return 1-smoothstep(state.inFor/WINDWIPE.contentOutS);
  return 0;
}
/** Hold drift (SPEC: right 22 pt/s, bob ±5 pt at 2.6 rad/s); the three breathing wind dots show after 3 s of hold. */
export function holdDrift(holdS:number):{dx:number;dy:number;dots:boolean}{
  const t=Math.max(0,holdS);return {dx:Math.min(WINDWIPE.driftPtS*t,WINDWIPE.driftPtS*8),dy:WINDWIPE.bobPt*Math.sin(WINDWIPE.bobRad*t),dots:t>=WINDWIPE.dotsAfterS};
}
export interface WindWipeHost{
  now():number;
  wait(seconds:number):Promise<void>;
  /** Next frame (or a short wait); used while holding for the load / readiness. */
  frame():Promise<void>;
  cover(alpha:number,seconds:number):Promise<void>|void;
  content?(c:WipeContent|null):void;
  audioOut?(seconds:number):Promise<void>|void;
  audioIn?(seconds:number):void;
  log?(event:string,data?:any):void;
}
export interface WindWipeRun{
  content?:WipeContent|null;
  /** Work done under the cover (scene switch / load). Its rejection aborts: the cover lifts, audio comes back. */
  work?:()=>Promise<any>;
  /** Reveal gate: the next scene is loaded, she stands where she should and the camera is placed. Polled every frame. */
  ready?:()=>boolean;
  holdS?:number;outS?:number;inS?:number;maxHoldS?:number;
  /** Lifecycle hook kind (ScreenCover onWipeCovered / addWipeBeforeReveal / onWipeRevealed). */
  kind?:string;
}
export interface WindWipeResult{ok:boolean;reason?:string;value?:any;outS:number;holdS:number;inS:number;slowLoad:boolean;readyAtReveal:boolean}
import { emitWipeCovered, emitWipeRevealed, newWipeEvent, startWipeBeforeReveal } from '../world-r1/ScreenCover';
/** OUT (+ audio out) → work under cover → HOLD until ≥ holdS AND ready() → audio in + IN. Never lifts the cover while not ready
 *  (except at maxHoldS, logged as hold-timeout, so a broken load cannot lock the game behind the cloud forever). */
export async function runWindWipe(h:WindWipeHost,o:WindWipeRun={}):Promise<WindWipeResult>{
  const outS=o.outS??WINDWIPE.outS,holdS=o.holdS??WINDWIPE.holdS,inS=o.inS??WINDWIPE.inS,maxHoldS=o.maxHoldS??WINDWIPE.maxHoldS;
  const log=(e:string,d?:any)=>{try{h.log?.(e,d);}catch{}};
  try{h.content?.(o.content??null);}catch{}
  const t0=h.now();log('out',{outS,content:o.content??null});
  let aOut:Promise<unknown>;try{aOut=Promise.resolve(h.audioOut?.(outS)).catch(()=>{});}catch{aOut=Promise.resolve();}
  await Promise.all([aOut,h.cover(1,outS)]);
  const tFull=h.now();log('full');const ev=newWipeEvent(o.kind??'wipe',o.content??null);emitWipeCovered(ev);
  let value:any,ok=true,reason:string|undefined;
  try{value=o.work?await o.work():undefined;if(value&&typeof value==='object'&&value.ok===false){ok=false;reason=value.reason||'work-failed';}}
  catch(e){ok=false;reason=String((e as Error)?.message??e);}
  const tWork=h.now(),slowLoad=tWork-tFull>holdS;
  let ready=false;const hooks=startWipeBeforeReveal(ev);
  for(;;){
    let r=true;try{r=(o.ready?!!o.ready():true)&&hooks();}catch{r=false;}
    const held=h.now()-tFull;
    if(!ok){ready=r;break;}
    if(r&&held+1e-6>=holdS){ready=true;break;}
    if(held>=maxHoldS){log('hold-timeout',{held});ready=false;break;}
    await h.frame();
  }
  const tReveal=h.now();log('in',{ready,held:tReveal-tFull,slowLoad,ok,reason});
  try{h.audioIn?.(inS);}catch{}
  try{h.content?.(null);}catch{}
  await Promise.resolve(h.cover(0,ok?inS:.2)).catch(()=>{});
  log('clear',{total:h.now()-t0});emitWipeRevealed(ev);
  return {ok,reason,value,outS:tFull-t0,holdS:tReveal-tFull,inS:h.now()-tReveal,slowLoad,readyAtReveal:ready};
}
/** Holds an already-full cover until ≥ minS have passed since `fullAt` AND ready() (used by RegionJourneyCore / home). */
export async function holdUntilReady(h:{now():number;frame():Promise<void>},fullAt:number,minS:number,ready:()=>boolean,maxS:number=WINDWIPE.maxHoldS):Promise<{held:number;ready:boolean}>{
  for(;;){let r=true;try{r=!!ready();}catch{r=false;}const held=h.now()-fullAt;if(r&&held+1e-6>=minS)return {held,ready:true};if(held>=maxS)return {held,ready:false};await h.frame();}
}
