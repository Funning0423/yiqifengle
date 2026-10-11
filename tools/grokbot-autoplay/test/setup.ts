// Runs before the glue module evaluates: fake monotonic clock + launch query from env.
export const clock={ms:0};
Object.defineProperty(globalThis,'performance',{value:{now:()=>clock.ms},configurable:true,writable:true});
const q=process.env.GB_QUERY;if(q)(globalThis as any).location={search:q};
const logs:string[]=[];(globalThis as any).__testLogs=logs;
const orig=console.log;console.log=(...a:any[])=>{const s=a.join(' ');logs.push(s);if(process.env.GB_VERBOSE)orig(s);};
/* ---- fake WeChat platform + REAL prelude (moved here from harness.ts so they exist BEFORE any game module evaluates; the fake
 * Cocos touch source in harness.ts still registers AFTER the prelude, as the engine does). Same numbers as harness W/H. ---- */
import {readFileSync} from 'fs';
const SW=390,SH=844,G:any=globalThis;
export const raw:Record<string,Function[]>={};
G.wx={getWindowInfo:()=>({windowWidth:SW,windowHeight:SH,safeArea:{left:0,right:SW,top:47,bottom:SH-34}}),getSystemInfoSync:()=>({windowWidth:SW,windowHeight:SH}),getMenuButtonBoundingClientRect:()=>({left:281,right:368,top:51,bottom:83}),
 onHide:(f:any)=>{G.__wxHide=f;},onShow:(f:any)=>{G.__wxShow=f;}};
for(const k of ['TouchStart','TouchMove','TouchEnd','TouchCancel']){raw[k]=[];G.wx['on'+k]=(f:Function)=>{raw[k].push(f);};G.wx['off'+k]=(f?:Function)=>{raw[k]=f?raw[k].filter(x=>x!==f):[];};}
if(process.env.GB_PRELUDE!=='0')(0,eval)(readFileSync(process.env.GB_PRELUDE_FILE!,'utf8'));
