/** Pure geometry shared by the Cocos mesh builder and cloud visual/geometry QA.
 * Units are UI points. Both states occupy the identical root rectangle. */
export interface WarmGeometry { positions:number[]; normals:number[]; colors:number[]; indices:number[]; }
export const WARM_BUTTON_TILT = 26 * Math.PI / 180;
const C = Math.cos(WARM_BUTTON_TILT), S = Math.sin(WARM_BUTTON_TILT);
const linear = (n:number) => {n/=255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4);};
function rgb(hex:string){return [linear(parseInt(hex.slice(1,3),16)),linear(parseInt(hex.slice(3,5),16)),linear(parseInt(hex.slice(5,7),16))];}
export function warmButtonGeometry(width:number,height:number,ivory=false,pressed=false):WarmGeometry {
  const g:WarmGeometry={positions:[],normals:[],colors:[],indices:[]};
  const depth=Math.min(10.5,height*.24), radius=Math.min(13,(height-8)/2);
  const vertex=(x:number,y:number,z:number,nx:number,ny:number,nz:number,color:number[])=>{
    const i=g.positions.length/3;
    g.positions.push(x,y*C+z*S-2,z*C-y*S);
    g.normals.push(nx,ny*C+nz*S,nz*C-ny*S);g.colors.push(...color,1);return i;
  };
  function solid(w:number,h:number,r:number,bottom:number,top:number,bevel:number,hex:string){
    r=Math.min(r,w/2-.1,h/2-.1);
    const color=rgb(hex), b=Math.min(bevel,(top-bottom)*.45), start=g.positions.length/3;
    // A rounded, bevelled solid: curved bevel profile and real, vertical sidewall.
    const profile=[{inset:b,z:bottom,nxy:0,nz:-1},
      {inset:b*(1-Math.SQRT1_2),z:bottom+b*(1-Math.SQRT1_2),nxy:Math.SQRT1_2,nz:-Math.SQRT1_2},
      {inset:0,z:bottom+b,nxy:1,nz:0}, {inset:0,z:top-b,nxy:1,nz:0},
      {inset:b*(1-Math.SQRT1_2),z:top-b*(1-Math.SQRT1_2),nxy:Math.SQRT1_2,nz:Math.SQRT1_2},
      {inset:b,z:top,nxy:0,nz:1}];
    const ring=36;
    for(const p of profile)for(let corner=0;corner<4;corner++)for(let step=0;step<=8;step++){
      const angle=(corner*90+step*90/8)*Math.PI/180,nx=Math.cos(angle),ny=Math.sin(angle);
      const cx=(corner===0||corner===3?1:-1)*(w/2-r),cy=(corner<2?1:-1)*(h/2-r);
      vertex(cx+nx*(r-p.inset),cy+ny*(r-p.inset),p.z,nx*p.nxy,ny*p.nxy,p.nz,color);
    }
    for(let k=0;k<profile.length-1;k++)for(let j=0;j<ring;j++){
      const a=start+k*ring+j,b0=start+k*ring+(j+1)%ring,c=b0+ring,d=a+ring;
      g.indices.push(a,b0,c,a,c,d);
    }
    const bottomCenter=vertex(0,0,bottom,0,0,-1,color),topCenter=vertex(0,0,top,0,0,1,color);
    for(let j=0;j<ring;j++){
      g.indices.push(bottomCenter,start+(j+1)%ring,start+j);
      const a=start+(profile.length-1)*ring+j,b0=start+(profile.length-1)*ring+(j+1)%ring;
      g.indices.push(topCenter,a,b0);
    }
  }
  // Dark recessed foot, solid warm timber/brass chassis, ceramic cap. No painted border rings.
  solid(width-2,height-5,radius+1,-1,1.4,.7,ivory?'#624b32':'#24443c');
  solid(width-4,height-7,radius,1,depth-3.5,1.1,ivory?'#c39a5e':'#b09255');
  // Pressing is a physical 2px projected cap travel, so the label's established 2px travel agrees.
  const travel=pressed?2/S:0,capTop=depth+3-travel;
  solid(width-6,height-10,Math.max(3,radius-1),Math.min(depth-3,capTop-2.1),capTop,1.7,ivory?'#fff0cb':'#377f6c');
  return g;
}
export function warmButtonPairGeometry(width:number,height:number,ivory=false):WarmGeometry {
  const out:WarmGeometry={positions:[],normals:[],colors:[],indices:[]};
  for(const pressed of [false,true]){
    const g=warmButtonGeometry(width,height,ivory,pressed),offset=out.positions.length/3;
    for(let i=0;i<g.positions.length;i+=3)out.positions.push(g.positions[i]+(pressed?width/2:-width/2),g.positions[i+1],g.positions[i+2]);
    out.normals.push(...g.normals);out.colors.push(...g.colors);out.indices.push(...g.indices.map(i=>i+offset));
  }
  return out;
}
