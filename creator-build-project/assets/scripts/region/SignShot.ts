/** p0drag12 (Mac p0drag11: the 'sign' QA shot from the text side was ~5.5 m from the panel — left side cropped, she not visible).
 * Within the explore arm (≤ 12 m) no lens shows her AND the whole sign: every walkable island spot is 7.9–24 m behind the sign's
 * front plane and the island rocks hide her from the shallows. So this one QA shot raises the arm (≤ maxArmM, ~26 m in practice):
 * a held pose, lens over the sea on the text side, aimed between her body and the sign, chosen so that on ALL portrait screens
 *  - her body is inside the safe margins (herMargin ≥ 0),
 *  - the whole sign rect is on screen (inset px), uncropped,
 *  - her head and chest are not hidden (guardEval against the island boxes + the sign's own world AABB),
 *  - the text faces the lens (≤ maxTextDeg off its normal → readable, never mirrored).
 * Smallest arm wins (she stays as large as possible), then the more frontal / larger text. Engine-free, world metres. */
import {ISLAND_PROPS,propCorners,signTextCenter,signpostRectUi,projectRectUi} from '../world-r2/IslandPropsLayout';
import {characterBox} from '../world-r1/CameraPose';
import {fromLookAt} from '../world-r1/CameraPose';
import {herMargin,LENS_SMOOTH} from './LensSmooth';
const LENS_BODY_TOP=LENS_SMOOTH.bodyM[1];
import {guardEval,type OccBox} from './LensOcclusion';
import {SCREENS} from './ExploreCameraCore';
type V3=[number,number,number];
export type SignShot={i:number;position:V3;target:V3;fovVerticalDeg:number;armM:number;textDeg:number;minTextPx:number;herFrac?:number[];clearM?:number};
/** p0drag13 option B (owner, Oct 25): frame her + the TEXT PANEL only (not the whole post) so the lens can come closer.
 * World corners of the sign's text quad (front face, local +Z). */
export function signTextCorners():V3[]{const S=ISLAND_PROPS.signpost,a=S.yawDeg*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),t=S.text,k=S.scale;
 const out:V3[]=[];for(const dx of [-t.widthM/2,t.widthM/2])for(const dy of [-t.heightM/2,t.heightM/2]){const l=[t.center[0]+dx,t.center[1]+dy,t.center[2]];
  out.push([S.position[0]+k*(l[0]*c+l[2]*sn),S.position[1]+k*l[1],S.position[2]+k*(-l[0]*sn+l[2]*c)]);}return out;}
/** Island gull flight space (GullFlockCore GULL_FX): sea glide band (seaY+0.7), island flight layer (flyY 7.5 over r 13 around c),
 * perches. A lens pose is clear when it keeps planClearM (1.6 m) from the band / layer and camFleeM (2.6 m) from every perch. */
export const GULL_SPACE={seaGlideY:-0.92+0.7,flyY:7.5,c:[1.5,1],r:13,clearM:1.6,perches:[[3.25,4.55,-1.38],[4.3,4.55,-1.38],[8.15,1.27,0.1],[7.75,1.27,2.0],[-1.65,1.04,0.3]],perchM:2.6};
export function gullClear(P:readonly number[]):boolean{const G=GULL_SPACE;if(P[1]<G.seaGlideY+G.clearM)return false;
 if(Math.hypot(P[0]-G.c[0],P[2]-G.c[1])<=G.r+G.clearM&&Math.abs(P[1]-G.flyY)<G.clearM)return false;
 return G.perches.every(q=>Math.hypot(P[0]-q[0],P[1]-q[1],P[2]-q[2])>=G.perchM);}
const boxDist=(P:readonly number[],b:OccBox)=>Math.hypot(...[0,1,2].map(k=>Math.max(b.min[k]-P[k],0,P[k]-b.max[k])));
export function signShot(feet:readonly (readonly number[])[],boxes:readonly OccBox[],fov=42,o:{maxTextDeg?:number;inset?:number;maxArmM?:number;textOnly?:boolean;pitches?:readonly number[];dists?:readonly number[];ws?:readonly number[];minTextPx?:number;minClearM?:number;screens?:readonly (readonly [number,number])[]}={}):SignShot|null{
 const S=ISLAND_PROPS.signpost,a=S.yawDeg*Math.PI/180,n=[Math.sin(a),0,Math.cos(a)],C=propCorners(S,S.boxMin,S.boxMax);
 const sc=C.reduce((m,p)=>[m[0]+p[0]/8,m[1]+p[1]/8,m[2]+p[2]/8],[0,0,0]),tc=signTextCenter();
 const lo=[0,1,2].map(k=>Math.min(...C.map(q=>q[k]))) as V3,hi=[0,1,2].map(k=>Math.max(...C.map(q=>q[k]))) as V3,bx=boxes.concat([{min:lo,max:hi}] as any);
 const cosMax=Math.cos((o.maxTextDeg??60)*Math.PI/180),inset=o.inset??12,maxArm=o.maxArmM??32,scr=o.screens??SCREENS;
 let best:SignShot|null=null,bs=Infinity;const TC=o.textOnly?signTextCorners():null,minClear=o.minClearM??0;
 for(let i=0;i<feet.length;i++){const h=feet[i],bc=[h[0],h[1]+0.85,h[2]];
  for(const w of o.ws??[0.3,0.4,0.5,0.6])for(let yaw=-180;yaw<180;yaw+=5)for(const p of o.pitches??[10,15,20,25,30,35])for(const D of o.dists??[10,12,14,16,18,20,22,24,26,28]){
   const T:V3=[bc[0]*(1-w)+sc[0]*w,bc[1]*(1-w)+sc[1]*w,bc[2]*(1-w)+sc[2]*w],y=yaw*Math.PI/180,pr=p*Math.PI/180;
   const P:V3=[T[0]+Math.sin(y)*Math.cos(pr)*D,T[1]+Math.sin(pr)*D,T[2]+Math.cos(y)*Math.cos(pr)*D];
   const arm=Math.hypot(P[0]-h[0],P[1]-h[1]-1.15,P[2]-h[2]);if(arm>maxArm)continue;
   const v=[P[0]-tc[0],P[1]-tc[1],P[2]-tc[2]],vl=Math.hypot(v[0],v[1],v[2])||1,cos=(v[0]*n[0]+v[2]*n[2])/vl;if(cos<cosMax)continue;
   if(TC&&(!gullClear(P)||bx.some(b=>boxDist(P,b)<minClear)))continue;
   const pose={position:P,target:T,fovVerticalDeg:fov};const g=guardEval(pose as any,h as any,bx,{up:0,swing:0,share:1});if(g.head||g.chest||g.inside)continue;
   let ok=true,minTxt=Infinity;
   for(const [W,H] of scr){if(herMargin(P,T,fov,h,[[W,H]] as any)<0){ok=false;break;}
    const r=TC?projectRectUi(fromLookAt(pose as any),W,H,TC):signpostRectUi(fromLookAt(pose as any),W,H);if(!r||Math.abs(r.x)+r.width/2>W/2-inset||Math.abs(r.y)+r.height/2>H/2-inset){ok=false;break;}
    minTxt=Math.min(minTxt,TC?r.height:r.height*(S.text.heightM/(S.boxMax[1]-S.boxMin[1]))*cos);}
   if(!ok||(TC&&minTxt<(o.minTextPx??24)))continue;const s=arm-minTxt*0.05;
   if(s<bs){bs=s;best={i,position:P,target:T,fovVerticalDeg:fov,armM:arm,textDeg:Math.acos(Math.min(1,cos))*180/Math.PI,minTextPx:minTxt};}}}
 if(best){const cam=fromLookAt({position:best.position,target:best.target,fovVerticalDeg:fov} as any),hb=characterBox(feet[best.i] as V3,LENS_BODY_TOP,0.3);
  best.herFrac=scr.map(([W,H])=>{const r=projectRectUi(cam,W,H,hb);return r?r.height/H:0;});best.clearM=Math.min(...bx.map(b=>boxDist(best!.position,b)));}
 return best;
}
