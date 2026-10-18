import type {Vec} from '../world-r1/WorldFlowCore';
/** Day sail unlit tint (cream). Night is this hue pulled toward gray-blue. */
export const SAIL_DAY_SAIL_RGB:[number,number,number]=[255,246,228];
/** ~48% of the day sail luminance: gray-blue cream, blue spiral stays in the texture. */
export const SAIL_NIGHT_SAIL_RGB:[number,number,number]=[112,120,136];
export const SAIL_STAR_COUNT=28;
export const SAIL_STAR_DIST=34;
const norm=(a:Vec):Vec=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
const sub=(a:Vec,b:Vec):Vec=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/**
 * Sky pinpoints for the 390×844 K7 frame. Two rows in the top sky band
 * (above the sail), 28 stars, each a few pixels — not the old near-field diamonds.
 */
export function sailStarNdc():Array<[number,number]>{
 const out:Array<[number,number]>=[];
 for(let i=0;i<SAIL_STAR_COUNT;i++){
  const row=i%2,col=(i/2)|0;
  const nx=Math.max(-0.86,Math.min(0.86,-0.82+((col+(row?0.45:0))/13)*1.64));
  const ny=(row?0.905:0.955)-((i*5)%3)*0.012;
  out.push([nx,ny]);
 }
 return out;
}
/** Diamond half-extent (metres) that covers `px` screen pixels at `dist` on `screenH`. */
export function sailStarRadius(fovDeg:number,dist=SAIL_STAR_DIST,screenH=844,px=4.5):number{
 const t=Math.tan(fovDeg*Math.PI/360);
 return px*dist*t/screenH;
}
/** World positions of the night stars, using the same look-at basis as Cocos `Node.lookAt`. */
export function sailStarWorld(eye:Vec,target:Vec,fovDeg=52,screen:{w:number;h:number}={w:390,h:844}):{pos:Vec;radius:number}[]{
 const back=norm(sub(eye,target));
 const x=norm(cross([0,1,0],back));
 const y=cross(back,x);
 const fwd:Vec=[-back[0],-back[1],-back[2]];
 const th=Math.tan(fovDeg*Math.PI/360),aspect=screen.w/screen.h,dist=SAIL_STAR_DIST;
 const radius=sailStarRadius(fovDeg,dist,screen.h);
 return sailStarNdc().map(([nx,ny])=>{
  const rx=nx*dist*th*aspect,uy=ny*dist*th;
  const pos:Vec=[
   eye[0]+fwd[0]*dist+x[0]*rx+y[0]*uy,
   eye[1]+fwd[1]*dist+x[1]*rx+y[1]*uy,
   eye[2]+fwd[2]*dist+x[2]*rx+y[2]*uy,
  ];
  return {pos,radius};
 });
}
