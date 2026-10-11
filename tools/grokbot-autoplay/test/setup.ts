// Runs before the glue module evaluates: fake monotonic clock + launch query from env.
export const clock={ms:0};
Object.defineProperty(globalThis,'performance',{value:{now:()=>clock.ms},configurable:true,writable:true});
const q=process.env.GB_QUERY;if(q)(globalThis as any).location={search:q};
const logs:string[]=[];(globalThis as any).__testLogs=logs;
const orig=console.log;console.log=(...a:any[])=>{const s=a.join(' ');logs.push(s);if(process.env.GB_VERBOSE)orig(s);};
/* ---- fake WeChat platform + REAL prelude (moved here from harness.ts so they exist BEFORE any game module evaluates; the fake
 * Cocos touch source in harness.ts still registers AFTER the prelude, as the engine does). Same numbers as harness W/H. ---- */
import {readFileSync} from 'fs';
import {director,game} from 'cc';
const SW=390,SH=844,G:any=globalThis;
export const raw:Record<string,Function[]>={};
G.wx={getWindowInfo:()=>({windowWidth:SW,windowHeight:SH,safeArea:{left:0,right:SW,top:47,bottom:SH-34}}),getSystemInfoSync:()=>({windowWidth:SW,windowHeight:SH,platform:'devtools',model:'iPhone 15',system:'iOS 17.0',SDKVersion:'3.5.8',brand:'devtools',pixelRatio:3}),getMenuButtonBoundingClientRect:()=>({left:281,right:368,top:51,bottom:83}),
 onHide:(f:any)=>{G.__wxHide=f;},onShow:(f:any)=>{G.__wxShow=f;}};
for(const k of ['TouchStart','TouchMove','TouchEnd','TouchCancel']){raw[k]=[];G.wx['on'+k]=(f:Function)=>{raw[k].push(f);};G.wx['off'+k]=(f?:Function)=>{raw[k]=f?raw[k].filter(x=>x!==f):[];};}
if(process.env.GB_PRELUDE!=='0')(0,eval)(readFileSync(process.env.GB_PRELUDE_FILE!,'utf8'));
/* ---- fake gfx device for GB_MARK device:caps. GB_CAPS=webgl2 (default) | webgl1 (no device.gl -> canvas context, no float ext,
 * 0 vertex texture units) | throw (every device getter throws) | nodevice (director.root absent). ---- */
const mkGL=(v2:boolean,exts:string[],debug:boolean)=>({VERSION:0x1F02,RENDERER:0x1F01,VENDOR:0x1F00,getSupportedExtensions:()=>exts,
 getExtension:(n:string)=>debug&&n==='WEBGL_debug_renderer_info'?{UNMASKED_VENDOR_WEBGL:0x9245,UNMASKED_RENDERER_WEBGL:0x9246}:null,
 getParameter:(p:number)=>({0x1F02:v2?'WebGL 2.0 (OpenGL ES 3.0 Chromium)':'WebGL 1.0 (OpenGL ES 2.0 Chromium)',0x1F01:'WebKit WebGL',0x1F00:'WebKit',0x9246:'Apple M4 GPU',0x9245:'Apple Inc.',0x8B4C:v2?16:0,0x0D33:v2?8192:4096,0x8DFB:v2?1024:256} as any)[p]??null});
const capsMode=process.env.GB_CAPS||'webgl2';
if(capsMode==='webgl2')(director as any).root={device:{gfxAPI:7,renderer:'Apple M4 GPU',vendor:'Apple',capabilities:{maxVertexTextureUnits:16,maxTextureSize:8192,maxVertexUniformVectors:1024},getFormatFeatures:(f:number)=>f===44?3:0,gl:mkGL(true,['EXT_color_buffer_float','OES_texture_float_linear','WEBGL_debug_renderer_info'],true)}};
else if(capsMode==='webgl1'){const gl=mkGL(false,['OES_texture_half_float','OES_standard_derivatives'],false);(director as any).root={device:{gfxAPI:6,capabilities:{maxVertexTextureUnits:0,maxTextureSize:4096,maxVertexUniformVectors:256},getFormatFeatures:()=>0}};(game as any).canvas={getContext:(t:string)=>t==='webgl'?gl:null};}
else if(capsMode==='throw'){const dev:any={};for(const k of ['gfxAPI','renderer','vendor','capabilities','gl','getFormatFeatures'])Object.defineProperty(dev,k,{get(){throw Error('boom '+k);}});(director as any).root={device:dev};}
