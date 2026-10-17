'use strict';
// 运镜bot report helper (camera rules for GGbot's r4-prep B+): her frozen board copy (r4-prep B+) at the board camera = the region hook's end pose: on-screen footprint per screen
const Jn=require('./journey-scene.cjs');const {legs,routeLength,rotY,add,sub,mOff,sOff,yaw,sA,H,S,sampleRoute}=Jn;
const RB=H.load(S+'region/RegionBoardLanding.ts'),BL=H.load(S+'ui/BoardLayout.ts'),RC=H.load(S+'world-r1/RegionCameraData.ts');
const SRC={meadow:{region:'meadow',map:{toJourney:p=>add(rotY(180,p),mOff),toBoard:p=>rotY(-180,sub(p,mOff))}},skycity:{region:'skycity',map:{toJourney:p=>add(rotY(yaw,p),sOff),toBoard:p=>rotY(-yaw,sub(p,sOff))},anchors:{spawn:sA('anchor_spawn_girl'),court:sA('anchor_starcourt_center')}}};
const C=RC.REGION_CAMERA.islandCharacter;const out=[];
// The widest hint the board can say: every string literal passed to say() in ManagedMobileBoardUI plus the ManagedTools reasons and
// "<tool name> · 点选目标", measured with the game's own PopupKit.measure(text, 15) + 40 (ManagedMobileBoardUI.sizeToast), capped by
// this screen's layout.toast.maxWidth (r4.1, GGbot 260ea02: the banner sits above the tray, ≤ 330 pt, 12 pt in from the edges).
const SRCDIR=Jn.ROOT+'/creator-build-project/assets/scripts/',fsx=require('fs'),ui=fsx.readFileSync(SRCDIR+'ManagedMobileBoardUI.ts','utf8'),mt=fsx.readFileSync(SRCDIR+'world-r2/ManagedTools.ts','utf8'),pk=fsx.readFileSync(SRCDIR+'ui/PopupKit.ts','utf8');
const measureSrc=pk.match(/export function measure\(text: string, size: number\): number \{([\s\S]*?)\n\}/)[1],measure=new Function('text','size',measureSrc);
const sayW=(ui.match(/tw = measure\(text, (\d+)\), w = Math\.min\(this\.geo\?\.toast\.maxWidth \?\? (\d+), tw \+ (\d+)\)/)||[]).slice(1).map(Number);// [font, fallback cap, pad]
const names=[...mt.matchAll(/(\w+):'([^']+)'/g)].filter(m=>/[\u4e00-\u9fff]/.test(m[2])).map(m=>m[2]);
const hintTexts=[...new Set([...[...ui.matchAll(/this\.say\('([^']+)'/g)].map(m=>m[1]),...[...ui.matchAll(/\|\| '([^']+)'\)/g)].map(m=>m[1]),...[...mt.matchAll(/'([^']*[\u4e00-\u9fff][^']*)'/g)].map(m=>m[1]),...names.map(n=>n+' · 点选目标')])];
const widestText=Math.max(...hintTexts.map(t=>measure(t,sayW[0])+sayW[2]));const hintW=lay=>Math.min(lay.toast.maxWidth,widestText);
// GGbot's banner + tray footprints for r4.1 (team/ggbot/outbox/20261017T124421Z-r41-hint-above-tray/footprint.json, 260ea02), copied here.
const GGFP={'390x844':{b:[30,360,168,200],t:[18.1,371.9,212,587.6]},'375x667':{b:[22.5,352.5,162,194],t:[45.7,329.3,200,501]},'414x896':{b:[42,372,169.7,201.7],t:[19.2,394.8,215.4,614.2]},
 '320x568':{b:[12,308,162,194],t:[64.9,255.1,200,402]},'360x780':{b:[15,345,167.1,199.1],t:[9,351,210.1,573.2]},'768x1024':{b:[219,549,176.4,208.4],t:[154,614,228.8,717.1]},'390x520':{b:[30,360,139.7,171.7],t:[112,278,177.7,354]}};
module.exports.hint={sayW,widestTextPt:widestText,widest:hintTexts.slice().sort((a,b)=>measure(b,15)-measure(a,15)).slice(0,3),count:hintTexts.length};
// GGbot's toolbar keep-outs (pt, top-left origin, count badges + selection ring included, 3 tools), as sent 2026-10-17: an
// independent fixture, not derived from BoardLayout. The hint banner is checked at the widest hint (hintW below) and against GGFP.
const GG={'390x844':{y:[693,772],x:[[76,151],[158,233],[240,315]]},'375x667':{y:[521,589],x:[[85,149],[155,220],[226,290]]},'414x896':{y:[742,826],x:[[80,160],[167,247],[254,334]]},
 '320x568':{y:[422,488],x:[[62,126],[128,192],[194,258]]},'768x1024':{y:[865,959],x:[[241,331],[339,429],[437,527]]},'1024x768':{y:[153,219],x:[[69,133],[135,199],[201,265]]}};
// 1024x768 landscape is out of scope (the WeChat mini-game is portrait only; Grok Bot 2026-10-17).
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
for(const region of ['meadow','skycity'])for(const [w,h] of SCREENS){
 // r4: meadow = the route for THIS screen (her stand stop, Jn.leg1For), skycity = the 08→09 route as built (unchanged end).
 const path=region==='meadow'?Jn.leg1For(w,h):legs.find(l=>l.id==='08-09').path,L=routeLength(path),root=sampleRoute(path,L).slice(0,3),b=RB.regionBoardEnd(SRC[region],w/h);
 const f=sub(b.target,b.position),fl=Math.hypot(...f);const F=f.map(x=>x/fl),R=[F[2],0,-F[0]].map((x,_,a)=>x/Math.hypot(a[0],a[2])),U=[R[1]*F[2]-R[2]*F[1],R[2]*F[0]-R[0]*F[2],R[0]*F[1]-R[1]*F[0]].map(x=>-x);
 for(let k=0;k<3;k++)R[k]=-R[k];// screen right = F x up (the vector above was screen-left; U is built from it, so flip after)
 const t=Math.tan(b.fovVerticalDeg*Math.PI/360),asp=w/h;const pts=[];
 for(const dx of [-C.halfWidthM,C.halfWidthM])for(const dz of [-C.halfWidthM,C.halfWidthM])for(const y of [0,C.heightM]){const q=sub([root[0]+dx,root[1]+y,root[2]+dz],b.position),z=q[0]*F[0]+q[1]*F[1]+q[2]*F[2];pts.push(z>0?[(q[0]*R[0]+q[1]*R[1]+q[2]*R[2])/(z*t*asp),(q[0]*U[0]+q[1]*U[1]+q[2]*U[2])/(z*t),z]:null);}
 const safe=BL.boardSafeInsets(w,h),lay=BL.boardLayout(w,h,safe,4);
 if(pts.some(p=>!p)){out.push({region,screen:`${w}x${h}`,behindCamera:true});continue;}
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const ndc={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
 const px={l:(ndc.minX+1)/2*w,r:(ndc.maxX+1)/2*w,t:(1-ndc.maxY)/2*h,b:(1-ndc.minY)/2*h};const cl={l:Math.max(0,px.l),r:Math.min(w,px.r),t:Math.max(0,px.t),b:Math.min(h,px.b)};
 const vis=cl.r>cl.l&&cl.b>cl.t;const rect=r=>({l:r.x-r.width/2,r:r.x+r.width/2,t:r.y-r.height/2,b:r.y+r.height/2});const ov=(a,q)=>Math.max(0,Math.min(a.r,q.r)-Math.max(a.l,q.l))*Math.max(0,Math.min(a.b,q.b)-Math.max(a.t,q.t));
 const area=vis?(cl.r-cl.l)*(cl.b-cl.t):0,tray=rect(lay.tray),plate=rect(lay.plate);
 const ui=[['tray',tray],['plate',plate],...BL.toolSlots(lay,3).map((x,i)=>['tool'+i,{l:x-lay.tools.size/2,r:x+lay.tools.size/2,t:lay.tools.y-lay.tools.size/2,b:lay.tools.y+lay.tools.size/2}]),['pause',{l:lay.pause.x-lay.pause.hit/2,r:lay.pause.x+lay.pause.hit/2,t:lay.pause.y-lay.pause.hit/2,b:lay.pause.y+lay.pause.hit/2}],...(safe.capsule?[['capsule',{l:safe.capsule.left,r:safe.capsule.right,t:safe.capsule.top,b:safe.capsule.bottom}]]:[]),
  // selection ring / count badge around each icon, and the hint toast (≤330 x 32 pt + shadow) centred on layout.toast
  ...BL.toolSlots(lay,3).map((x,i)=>['toolRing'+i,{l:x-lay.tools.size/2-2,r:x+lay.tools.size/2+2,t:lay.tools.y-lay.tools.size/2-2,b:lay.tools.y+lay.tools.size/2+4}]),['hintBanner',{l:lay.toast.x-hintW(lay)/2,r:lay.toast.x+hintW(lay)/2,t:lay.toast.y-lay.toast.height/2,b:lay.toast.y+lay.toast.height/2+2}],
  ...(GGFP[`${w}x${h}`]?[['ggbotBanner',{l:GGFP[`${w}x${h}`].b[0],r:GGFP[`${w}x${h}`].b[1],t:GGFP[`${w}x${h}`].b[2],b:GGFP[`${w}x${h}`].b[3]}],['ggbotTray',{l:GGFP[`${w}x${h}`].t[0],r:GGFP[`${w}x${h}`].t[1],t:GGFP[`${w}x${h}`].t[2],b:GGFP[`${w}x${h}`].t[3]}]]:[]),
  ...(GG[`${w}x${h}`]?[...GG[`${w}x${h}`].x.map(([l,r],i)=>['ggbotTool'+i,{l,r,t:GG[`${w}x${h}`].y[0],b:GG[`${w}x${h}`].y[1]}])]:[]),['safeTop',{l:0,r:w,t:0,b:safe.top}],['safeBottom',{l:0,r:w,t:h-safe.bottom,b:h}]];
 const hits=vis?ui.filter(([,q])=>ov(px,q)>0).map(([n])=>n):[],gapPt=vis&&!hits.length?Math.min(...ui.map(([,q])=>Math.hypot(Math.max(q.l-px.r,px.l-q.r,0),Math.max(q.t-px.b,px.t-q.b,0))),px.l,w-px.r,px.t,h-px.b):null;
 out.push({region,screen:`${w}x${h}`,foot:root.map(v=>+v.toFixed(3)),cropped:vis&&(px.l<0||px.r>w||px.t<0||px.b>h),coveredBy3ToolUi:hits,clearOf3ToolUi:vis&&!hits.length&&!(px.l<0||px.r>w||px.t<0||px.b>h),gapPt:gapPt===null?null:+gapPt.toFixed(1),distanceM:+Math.min(...pts.map(p=>p[2])).toFixed(2),visible:vis,boxPt:{l:+px.l.toFixed(1),r:+px.r.toFixed(1),t:+px.t.toFixed(1),b:+px.b.toFixed(1)},widthFrac:vis?+((cl.r-cl.l)/w).toFixed(3):null,heightFrac:vis?+((cl.b-cl.t)/h).toFixed(3):null,ndcX:[+ndc.minX.toFixed(2),+ndc.maxX.toFixed(2)],
  inFrameLimits:ndc.minX>=-RC.REGION_CAMERA.frameLimits.maxAbsX&&ndc.maxX<=RC.REGION_CAMERA.frameLimits.maxAbsX&&ndc.minY>=RC.REGION_CAMERA.frameLimits.minY&&ndc.maxY<=RC.REGION_CAMERA.frameLimits.maxY,
  trayPt:{l:+tray.l.toFixed(1),r:+tray.r.toFixed(1),t:+tray.t.toFixed(1),b:+tray.b.toFixed(1)},underTrayShareOfHer:area?+(ov(cl,tray)/area).toFixed(3):0,underPlateShareOfHer:area?+(ov(cl,plate)/area).toFixed(3):0,
  underToolIconsShareOfHer:Object.fromEntries([1,2,3].map(n=>[n+'tools',area?+(BL.toolSlots(lay,n).reduce((a,x)=>a+ov(cl,{l:x-lay.tools.size/2,r:x+lay.tools.size/2,t:lay.tools.y-lay.tools.size/2,b:lay.tools.y+lay.tools.size/2}),0)/area).toFixed(3):0]))});}
if(require.main===module)console.log(JSON.stringify(out,null,0).replace(/\},\{/g,'},\n{'));const hint=module.exports.hint;module.exports=out;out.hint=hint;
