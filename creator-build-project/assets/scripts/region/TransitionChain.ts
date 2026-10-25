/** P0 continuous action-chain transitions (Funning P0, Grok Bot approved 2026-10-25). Pure: no 'cc' import (node tests load it).
 *  Every mainline leg (island→meadow sail, meadow→skycity balloon, skycity→lakeside balloon) plays as ONE visible chain:
 *  no WindWipe, no dark loading card (vehicle icon + place name), no place-name sign or other UI over the transition.
 *  The camera leaves the live level lens with a continuous handoff (TransitionCamera primitives) and the next level lens is
 *  reached by the route's board-end blend.
 *  WindWipe survives ONLY as a fallback: when loading is still not done after waiting CHAIN_FALLBACK.waitS (3 s). Every trigger
 *  is counted (__QF_TRANSITION_FALLBACK) and logged with console.warn (never console.error). Acceptance: 0 triggers.
 *  The fallback never shows the loading card (coverContent stays null). Ride skip and 回小岛 keep their own WindWipe. */
import type {Pose} from '../world-r1/WorldFlowCore';
import {blendPose,minJerk,ViewLimiter,TRANSITION_CAM} from './TransitionCamera';
import {stopEngineStates,type EngineAnimLike} from './EngineAnimStop';
export type ChainLeg='sail'|'balloon'|'lakeside';
/** Master switch. `?windwipe=legacy` (web QA only) restores the old cover path for A/B comparison. */
let legacyDepth=0;
/** skyfix: bounded fallback — run one travel with the WindWipe cover path (continuousTransitions() false meanwhile). */
export async function withLegacyTransition<T>(fn:()=>Promise<T>|T):Promise<T>{legacyDepth++;try{return await fn();}finally{legacyDepth--;}}
export function continuousTransitions(q?:string):boolean{
 if(legacyDepth>0&&q===undefined)return false;
 try{const s=q!==undefined?q:(typeof location!=='undefined'?String(location.search||''):'');return !/(?:^|[?&])windwipe=legacy(?:&|$)/.test(s);}catch{return true;}
}
/** Required segment order per leg (each segment plays visibly; nothing is skipped). */
export const CHAIN_SEGMENTS:Readonly<Record<ChainLeg,readonly string[]>>=Object.freeze({
 sail:['A1-pier-walk','A2-gangplank-board','A3-sail','A4-dock','A5-gangplank-off','A6-meadow-first'],
 balloon:['B1-basket-in','B2-ignite-inflate','B3-flight','B4-settle','B5-door-walk-out'],
 lakeside:['C1-basket-in','C2-ignite-inflate','C3-flight','C4-settle','C5-door-walk-out'],
});
type ChainEvent={leg:ChainLeg;seg:string;at:number};
const G=():any=>{try{return globalThis as any;}catch{return {};}};
const now=()=>{try{return typeof performance!=='undefined'&&performance.now?performance.now()/1000:Date.now()/1000;}catch{return 0;}};
/** Trace a segment start (QA: __QF_CHAIN.events; order checked, an out-of-order mark warns). */
export function chainMark(leg:ChainLeg,seg:string,at:number=now()):boolean{
 const g=G();const c=g.__QF_CHAIN||(g.__QF_CHAIN={events:[] as ChainEvent[],bad:0});
 const order=CHAIN_SEGMENTS[leg],i=order.indexOf(seg);
 const prev=[...c.events].reverse().find((e:ChainEvent)=>e.leg===leg);
 const pi=prev?order.indexOf(prev.seg):-1;
 const ok=i>=0&&(i===0||i===pi+1);
 if(i===0)c.events=c.events.filter((e:ChainEvent)=>e.leg!==leg);
 c.events.push({leg,seg,at});
 if(!ok){c.bad++;try{console.warn('[QF_CHAIN] out-of-order segment '+leg+':'+seg+' after '+(prev?prev.seg:'none'));}catch{}}
 return ok;
}
export function chainEvents(leg?:ChainLeg):ChainEvent[]{const e:ChainEvent[]=G().__QF_CHAIN?.events||[];return leg?e.filter(x=>x.leg===leg):e.slice();}
export function chainOrderOk(leg:ChainLeg,segs:readonly string[]):boolean{const o=CHAIN_SEGMENTS[leg];return segs.length===o.length&&segs.every((s,i)=>s===o[i]);}
export function resetChainTrace(){const g=G();g.__QF_CHAIN={events:[],bad:0};g.__QF_TRANSITION_FALLBACK={count:0,events:[]};g.__QF_ANIM_GUARD={count:0,stopped:0,tags:[]};g.__QF_PRELOAD={events:[],bytes:0};}
// ── fallback ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const CHAIN_FALLBACK=Object.freeze({waitS:3});
/** 'go' = loaded, play the chain; 'wait' = keep waiting visibly (she idles, live lens); 'fallback' = waited > waitS. */
export function fallbackDecision(waitedS:number,ready:boolean):'go'|'wait'|'fallback'{if(ready)return 'go';return waitedS>=CHAIN_FALLBACK.waitS?'fallback':'wait';}
export function recordFallback(leg:string,waitedS:number,reason:string):number{
 const g=G();const f=g.__QF_TRANSITION_FALLBACK||(g.__QF_TRANSITION_FALLBACK={count:0,events:[]});
 f.count++;f.events.push({leg,waitedS:Math.round(waitedS*1000)/1000,reason});
 try{console.warn('[QF_TRANSITION] WindWipe fallback #'+f.count+' '+JSON.stringify({leg,waitedS,reason}));}catch{}
 return f.count;
}
export function fallbackCount():number{return Number(G().__QF_TRANSITION_FALLBACK?.count)||0;}
// ── camera handoff (live level lens → transition lens) ──────────────────────────────────────────────────────────────────
/** Wraps the pose a transition wants to write: for the first blendS seconds it is mixed from the live lens it left
 *  (min-jerk weight: position/view/FOV C2-continuous) and the written view passes the approved yaw caps (ViewLimiter). */
export class LiveHandoff{
 t=0;private lim=new ViewLimiter();readonly blendS:number;done=false;
 constructor(private from:Pose,target0:Pose|null,blendS:number=TRANSITION_CAM.blendInS,private mode:'stand'|'walk'='walk'){
  const gap=target0?Math.hypot(target0.position[0]-from.position[0],target0.position[1]-from.position[1],target0.position[2]-from.position[2]):0;
  this.blendS=Math.max(blendS,1.875*gap/TRANSITION_CAM.blendLensMS);this.lim.reset(from);}
 step(want:Pose,dt:number):Pose{this.t+=Math.max(0,Math.min(.1,dt));const w=minJerk(this.t/this.blendS);
  const raw=w>=1?want:blendPose(this.from,want,w);const out=this.lim.step(raw,dt,this.mode);if(w>=1&&this.lim.settled)this.done=true;return out;}
}
// ── B2 procedural inflate ───────────────────────────────────────────────────────────────────────────────────────────────
/** Envelope from flat to full in durationS: vertical first, then horizontal, eased out with a slight rebound; the burner
 *  flame brightness follows the push (bright while it grows, settling to the cruise flicker level). */
export const INFLATE=Object.freeze({durationS:3.0,vert:[0,1.9] as const,horiz:[0.8,3.0] as const,flatY:.12,flatXZ:.55,rebound:.06,flameMin:.35,flameMax:1.35});
const seg=(t:number,a:number,b:number)=>Math.max(0,Math.min(1,(t-a)/(b-a)));
/** easeOutBack-like with a small overshoot k; f(0)=0, f(1)=1, peak 1+k·(~0.1). */
export function reboundEase(u:number,k:number=INFLATE.rebound):number{const x=Math.max(0,Math.min(1,u));if(x>=1)return 1;const s=1-x;return 1-s*s*s+k*Math.sin(Math.PI*x)*x*x*(1-x)*6;}
export function inflateAt(t:number):{sy:number;sxz:number;flame:number;done:boolean}{
 const I=INFLATE,v=reboundEase(seg(t,I.vert[0],I.vert[1])),h=reboundEase(seg(t,I.horiz[0],I.horiz[1]));
 const sy=I.flatY+(1-I.flatY)*v,sxz=I.flatXZ+(1-I.flatXZ)*h;
 const push=Math.max(0,Math.min(1,t/0.25))*(1-seg(t,I.durationS-.6,I.durationS));
 const flame=t<=0?0:I.flameMin+(I.flameMax-I.flameMin)*push+(1-push)*(1-I.flameMin)*seg(t,I.durationS-.6,I.durationS);
 return {sy,sxz,flame,done:t>=I.durationS};
}
// ── B4/B5 door ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Ride clock (28.5 s, BalloonFlight warp): B4 settle 27.50–28.50, then B5: the door opens only after the settle. */
export const BALLOON_DOOR=Object.freeze({settleT0:27.5,settleT1:28.5/* ride clock = TRANSITION_RETIME.meadowRideS−1..meadowRideS (compress 30→28.5; no import: pure-file harnesses; test_chain_ggbot asserts the match) */,openDelayS:.15,openS:.8,openDeg:100,walkAfterOpenS:.35,closeS:.6});
/** Door angle t seconds after the ride clock reached settleT1 (B5 time). */
export function doorAngleAt(b5t:number,D=BALLOON_DOOR):number{return D.openDeg*minJerk((b5t-D.openDelayS)/D.openS);}
export function doorOpensAfterSettle(D=BALLOON_DOOR):boolean{return D.settleT1+D.openDelayS>=D.settleT1&&D.openDelayS>=0;}
/** B1 door (meadow, she walks in): opens as she arrives at the door front, closes behind her. */
export function doorInAngleAt(t:number,inAt:number,D=BALLOON_DOOR):number{
 const open=D.openDeg*minJerk(t/D.openS),close=t>inAt?minJerk((t-inAt)/D.closeS):0;return open*(1-close);}
// ── animation guard ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Stop every engine-played SkeletalAnimation state (sit_hold left playing) right before a walk; counted for QA. */
export function guardBeforeWalk(anim:EngineAnimLike|null|undefined,tag:string):number{
 const n=stopEngineStates(anim,tag);const g=G();const a=g.__QF_ANIM_GUARD||(g.__QF_ANIM_GUARD={count:0,stopped:0,tags:[]});
 a.count++;a.stopped+=n;a.tags.push(tag);if(a.tags.length>64)a.tags.shift();return n;
}
// ── preload ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type PreloadItem=Readonly<{bundle:string;bytes:number;prefab?:string}>;
/** Warmed when the LAST level of a region STARTS (mainline-04 / -08 / -12), hidden inside play time. Raw bundle sizes. */
export const PRELOAD_PLAN:Readonly<Record<string,Readonly<{stage:string;leg:ChainLeg;items:readonly PreloadItem[]}>>>=Object.freeze({
 meadow:{stage:'mainline-04',leg:'sail',items:[{bundle:'region_meadow',bytes:5500847},{bundle:'transport_sail',bytes:1011317}]},
 skycity:{stage:'mainline-08',leg:'balloon',items:[{bundle:'region_skycity',bytes:1961205},{bundle:'region_transit_balloon',bytes:1036082,prefab:'transport_balloon'}]},
 lakeside:{stage:'mainline-12',leg:'lakeside',items:[{bundle:'region_lakeside',bytes:2030414},{bundle:'region_transit_balloon',bytes:1036082,prefab:'transport_balloon'}]},
});
export const PRELOAD_MEMORY_BUDGET_MB=6;
export function preloadTargetForStage(stageId:string):string|null{for(const k of Object.keys(PRELOAD_PLAN))if(PRELOAD_PLAN[k].stage===stageId)return k;return null;}
/** Log one loaded bundle (size + ms) for the Mac memory check: [QF_PRELOAD] lines and __QF_PRELOAD {events, bytes}. */
export function logBundleLoad(target:string,item:PreloadItem,ms:number,ok:boolean):void{
 const g=G();const p=g.__QF_PRELOAD||(g.__QF_PRELOAD={events:[],bytes:0});
 p.events.push({target,bundle:item.bundle,bytes:item.bytes,ms:Math.round(ms),ok});if(ok)p.bytes+=item.bytes;
 try{console.info('[QF_PRELOAD] '+JSON.stringify({target,bundle:item.bundle,bytes:item.bytes,ms:Math.round(ms),ok,totalMB:Math.round(p.bytes/1048576*100)/100}));}catch{}
}
// ── player animation probe (全流程测试部: B_PASS2G_CURSOR.playing is null under the direct-TRS rig) ─────────────────────────
/** globalThis.__QF_PLAYER_ANIM (getter, read any time): {clip, loop?, time?, engine:[names of engine-PLAYING states], source}.
 *  clip = the rig/MotionClock base clip (what is actually drawn: walk_loop, sit_hold, stand_up, …); engine lists SkeletalAnimation
 *  states the engine itself is playing (should be [] — anything here overrides the rig, e.g. a stuck sit_hold). */
export function playerAnimOf(actor:any):{clip:string|null;loop:boolean|null;time:number|null;engine:string[];source:string}{
 const out={clip:null as string|null,loop:null as boolean|null,time:null as number|null,engine:[] as string[],source:'none'};if(!actor)return out;
 try{const b=actor.clock?.base;if(b&&typeof b.clip==='string'){out.clip=b.clip;out.source='rig';if(typeof b.loop==='boolean')out.loop=b.loop;if(typeof b.time==='number')out.time=b.time;}}catch{}
 try{const a=actor.anim;if(a&&a.clips)for(const c of a.clips){if(!c)continue;const st=a.getState?.(c.name);if(st&&st.isPlaying)out.engine.push(c.name);}
  if(!out.clip&&out.engine.length){out.clip=out.engine[0];out.source='engine';}}catch{}
 return out;
}
let probed:any=null;
export function installPlayerAnimProbe(actor:any):void{if(!actor||probed===actor)return;probed=actor;
 try{Object.defineProperty(globalThis,'__QF_PLAYER_ANIM',{configurable:true,enumerable:false,get:()=>playerAnimOf(probed)});}catch{}}
try{(globalThis as any).__qfInstallPlayerAnim=installPlayerAnimProbe;}catch{}
