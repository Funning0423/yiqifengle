// Type-check stand-in for the subset of 'cc' / 'cc/env' the T0 glue uses (Cocos 3.8.8 signatures).
declare module 'cc' {
 export class Director { static readonly EVENT_AFTER_UPDATE:string; on(t:string,f:(...a:any[])=>void,target?:any):void; off(t:string,f:(...a:any[])=>void,target?:any):void; getScene():any; getTotalFrames():number; }
 export const director:Director;
 export const game:{on(t:string,f:(...a:any[])=>void,target?:any):void;off(t:string,f:(...a:any[])=>void,target?:any):void;canvas:any};
 export class Game{static readonly EVENT_HIDE:string;static readonly EVENT_SHOW:string;}
 export const js:{getClassByName(n:string):any};
 export const screen:{devicePixelRatio:number;windowSize:{width:number;height:number}};
 export const input:{on(t:string,f:(e:any)=>void,target?:any):void;off(t:string,f:(e:any)=>void,target?:any):void;getTouchCount():number};
 export class Input{static readonly EventType:{TOUCH_START:string;TOUCH_MOVE:string;TOUCH_END:string;TOUCH_CANCEL:string}};
}
declare module 'cc/env' { export const EDITOR:boolean; export const DEBUG:boolean; }
