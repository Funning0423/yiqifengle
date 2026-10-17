/** Rainbow-bridge switch (§11). This branch only turns meadow→skycity into a balloon.
 * island→meadow stays 'bridge' so the sail branch can own that key. Unknown pairs stay 'bridge'. */
export type TransportKind='bridge'|'sail'|'balloon';
export const JOURNEY_TRANSPORT={'island-meadow':'bridge' as TransportKind,'meadow-skycity':'balloon' as TransportKind,'island-lakeside':'bridge' as TransportKind};
const KINDS:TransportKind[]=['bridge','sail','balloon'];
/** QA / web preview may force a kind. A WeChat release mini-program (envVersion release) ignores it,
 * so the player package cannot be switched into a test route. Node tests and web-test have no wx. */
export function qaTransportEnabled(host:any=globalThis):boolean{
 try{
  const wx=host?.wx;if(!wx)return true;
  const env=wx.getAccountInfoSync?.()?.miniProgram?.envVersion;
  if(env==='develop'||env==='trial')return true;
  return false;
 }catch{return false;}
}
function readOverride(host:any):TransportKind|null{
 if(!qaTransportEnabled(host))return null;
 const direct=host?.__QF_TRANSPORT;if(typeof direct==='string'&&(KINDS as string[]).includes(direct))return direct as TransportKind;
 try{const q=host?.location?.search;if(typeof q==='string'&&q.includes('transport=')){const v=new URLSearchParams(q).get('transport');if(v&&(KINDS as string[]).includes(v))return v as TransportKind;}}catch{}
 return null;
}
export function transportFor(from:string,to:string,host:any=globalThis):TransportKind{
 const forced=readOverride(host);if(forced)return forced;
 const key=(from+'-'+to) as keyof typeof JOURNEY_TRANSPORT;
 return JOURNEY_TRANSPORT[key]??'bridge';
}
