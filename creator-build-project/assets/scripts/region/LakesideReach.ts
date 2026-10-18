import {qaTransportEnabled} from './JourneyTransport';
import type {Vec} from '../world-r1/WorldFlowCore';
/** Plan A candidate (草原→湖畔→草原). Off unless a web/QA host asks: `?lakeside=1` or `__QF_LAKESIDE=1`.
 *  WeChat release ignores both. No on-screen copy. Default journey order stays island→meadow→skycity. */
export const LAKESIDE_SIDE_SPEED=1.2;
const APPROACH_M=4,CROSS_M=16,ARRIVE_M=6;
let spurHidden=false;
export function lakesideReachEnabled(host:any=globalThis):boolean{
 if(!qaTransportEnabled(host))return false;
 try{
  const flag=host?.__QF_LAKESIDE;
  if(flag==='1'||flag===1||flag===true)return true;
  let q='';
  if(typeof host?.location?.search==='string')q=host.location.search;
  else if(typeof location!=='undefined'&&typeof (location as {search?:unknown}).search==='string')q=String((location as {search:string}).search||'');
  return /(?:^|[?&])lakeside=1(?:&|$)/.test(q);
 }catch{return false;}
}
/** Meadow ↔ lakeside only. Anything else (including the shipped island→lakeside leg) stays on the old order. */
export function lakesideSideOrder(current:string,target:string):Array<'meadow'|'lakeside'>|null{
 if(!lakesideReachEnabled())return null;
 if(current==='meadow'&&target==='lakeside')return ['meadow','lakeside'];
 if(current==='lakeside'&&target==='meadow')return ['lakeside','meadow'];
 return null;
}
/** travelRegion may leave the lakeside only while the spur is open. Island and meadow stay as they are today. */
export function journeyTravelOriginOk(stable:string):boolean{
 if(stable==='island'||stable==='meadow')return true;
 return stable==='lakeside'&&lakesideReachEnabled();
}
export function setLakesideSpurHidden(hidden:boolean):void{spurHidden=!!hidden;}
export function lakesideSpurHidden():boolean{return spurHidden;}
/** Flat walk at 1.2 m/s. The middle span is a crossing window for the journey clock, not a rainbow arch. */
export function lakesideSideRoute(from:'meadow'|'lakeside',to:'meadow'|'lakeside',start:Vec){
 if(!lakesideReachEnabled())throw Error('lakeside-reach-off');
 if(!((from==='meadow'&&to==='lakeside')||(from==='lakeside'&&to==='meadow')))throw Error('journey-region-order');
 const dir=from==='meadow'?1:-1,y=start[1];
 const at=(z:number):Vec=>[start[0],y,start[2]+dir*z];
 const path=[at(0),at(APPROACH_M),at(APPROACH_M+CROSS_M),at(APPROACH_M+CROSS_M+ARRIVE_M)];
 return {from,to,path,bridgeStart:APPROACH_M,bridgeEnd:APPROACH_M+CROSS_M,speed:LAKESIDE_SIDE_SPEED,startBlendM:4 as number};
}
