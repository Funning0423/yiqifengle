/** 「主页」 from a journey region (Mac re-check 2607de6): fade out picture + audio, release the journey and place
 * her at home, resolve as soon as the flow state is home, then fade back in. Pure (no cc imports): the host
 * injects the cover, audio and a clock (foreground time in Boot) so tests can drive simulated time. Every path resolves. */
export const HOME_FADE={outS:.4,inS:.5,timeoutS:10} as const;
/** Cover alpha (0..1) → fill-colour byte; Graphics fills carry their own alpha (UIOpacity does not affect them). */
export function coverAlphaByte(a:number):number{return Math.max(0,Math.min(255,Math.round(255*(Number.isFinite(a)?a:0))));}
export type HomeResult={ok:boolean;reason?:string};
export interface HomeTransitionHost{
  now():number;                       // host clock seconds (Boot: foreground time, r4.1b; background trips do not count)
  wait(seconds:number):Promise<void>; // wait on that clock (rejecting is treated as a failure)
  cover(alpha:number,seconds:number):Promise<void>|void; // full-screen black cover ramp
  audioOut(seconds:number):Promise<void>|void; // region bgm + wind + sfx_* fade with the picture
  audioIn(seconds:number):void;       // island/home bgm fades in (after the region bed has stopped)
  audioRestore():void;                // failure: undo audioOut
  act():Promise<HomeResult>;          // flow.returnHome()
  state():string;
}
export async function runHomeTransition(h:HomeTransitionHost,o:{outS?:number;inS?:number;timeoutS?:number}={}):Promise<HomeResult&{seconds:number}>{
  const outS=o.outS??HOME_FADE.outS,inS=o.inS??HOME_FADE.inS,timeoutS=o.timeoutS??HOME_FADE.timeoutS,t0=h.now();
  let timer=false;const timeout=h.wait(timeoutS).then(()=>{timer=true;return {ok:false,reason:'return-home-timeout'} as HomeResult;},()=>({ok:false,reason:'return-home-timer-failed'} as HomeResult));
  const work=(async():Promise<HomeResult>=>{
    await Promise.all([h.cover(1,outS),h.audioOut(outS)]);
    if(timer)return {ok:false,reason:'return-home-timeout'};
    const r=await h.act();if(!r?.ok)return {ok:false,reason:r?.reason??'return-home-failed'};
    return h.state()==='home'?{ok:true}:{ok:false,reason:'return-home-wrong-state:'+h.state()};
  })().catch(e=>({ok:false,reason:String((e as Error)?.message??e)}));
  const r=await Promise.race([work,timeout]);
  const uncover=(s:number)=>{try{void Promise.resolve(h.cover(0,s)).catch(()=>{});}catch{}};
  if(r.ok){try{h.audioIn(inS);}catch{}uncover(inS);}
  else{try{h.audioRestore();}catch{}uncover(.2);}
  return {...r,seconds:h.now()-t0};
}
