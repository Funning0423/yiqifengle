/** Ending chime, built in code (no asset): low-poly wind chime layered over the lake-view render. Pure (no cc imports) so
 *  tests / previews use the same numbers. Units = ending source points (the ENDING_ART.chime box, 81 × 200), origin = hang
 *  point (top centre), +y up, +z toward the camera. Each tube / the clapper string hangs from its own top and swings on its
 *  own sine; the whole chime still swings ±4° / 3.2 s as one in 2D (ChimeSway). Colours from the LK_windchime palette. */
export interface ChimeGeom { positions:number[]; normals:number[]; colors:number[]; indices:number[]; }
export interface ChimePart { name:string; pivot:[number,number,number]; geom:ChimeGeom; swing:{z:number;x:number;period:number;phase:number}|null; }
export const ENDING_CHIME=Object.freeze({
  boxW:81,boxH:200,tiltDeg:24,
  plate:{r:34,y0:-6,y1:-20,sides:8,hex:'#D26A1C'},hook:{r:1.4,y1:-6,hex:'#4A2A10'},
  tube:{r:5.2,sides:6,top:-21,hex:'#E39A30',ring:21,
    list:[{a:205,len:110,period:2.7,phase:0},{a:295,len:92,period:3.1,phase:1.7},{a:25,len:128,period:2.9,phase:3.4},{a:115,len:102,period:3.4,phase:5.1}]},
  tubeSwing:{z:2.6,x:1.6},
  string:{w:1.3,top:-19,len:132,hex:'#3A1A06',clapperY:-92,clapperR:7,clapperH:3,clapperHex:'#B4743A',sailW:26,sailH:40,sailHex:'#B78C5E',
    swing:{z:3.4,x:2.0,period:3.68,phase:.9}},
  night:{mul:[.90,.86,.86],warm:[1,.81,.51],warmK:.16},
});
const lin=(n:number)=>{n/=255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4);};
/** sRGB hex → linear RGBA; night = dimmed and pulled toward the warm lamp. */
export function chimeColor(hex:string,night:boolean):number[]{
  let c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  if(night){const N=ENDING_CHIME.night;c=c.map((v,i)=>(v*(1-N.warmK)+N.warm[i]*N.warmK*v)*N.mul[i]);}
  return [lin(c[0]*255),lin(c[1]*255),lin(c[2]*255),1];
}
function prism(g:ChimeGeom,cx:number,cz:number,r:number,sides:number,yTop:number,yBot:number,col:number[],rot=0){
  const P=(i:number)=>{const a=rot+i*2*Math.PI/sides;return [cx+r*Math.cos(a),cz+r*Math.sin(a)];};
  const v=(x:number,y:number,z:number,n:number[])=>{g.positions.push(x,y,z);g.normals.push(n[0],n[1],n[2]);g.colors.push(...col);return g.positions.length/3-1;};
  for(let i=0;i<sides;i++){const [x0,z0]=P(i),[x1,z1]=P(i+1),am=rot+(i+.5)*2*Math.PI/sides,n=[Math.cos(am),0,Math.sin(am)];   // flat-shaded sides
    const a=v(x0,yTop,z0,n),b=v(x1,yTop,z1,n),c=v(x1,yBot,z1,n),d=v(x0,yBot,z0,n);g.indices.push(a,b,c,a,c,d);}
  for(const [y,ny] of [[yTop,1],[yBot,-1]] as const){const c0=v(cx,y,cz,[0,ny,0]);const ring:number[]=[];for(let i=0;i<sides;i++){const [x,z]=P(i);ring.push(v(x,y,z,[0,ny,0]));}
    for(let i=0;i<sides;i++){const a=ring[i],b=ring[(i+1)%sides];if(ny>0)g.indices.push(c0,b,a);else g.indices.push(c0,a,b);}}
}
function box(g:ChimeGeom,cx:number,yTop:number,yBot:number,w:number,col:number[]){prism(g,cx,0,Math.SQRT1_2*w,4,yTop,yBot,col,Math.PI/4);}
const empty=():ChimeGeom=>({positions:[],normals:[],colors:[],indices:[]});
/** Parts, each with geometry relative to its own pivot. */
export function endingChimeParts(night:boolean):ChimePart[]{
  const C=ENDING_CHIME,parts:ChimePart[]=[];
  const head=empty();prism(head,0,0,C.hook.r,6,0,C.hook.y1,chimeColor(C.hook.hex,night));prism(head,0,0,C.plate.r,C.plate.sides,C.plate.y0,C.plate.y1,chimeColor(C.plate.hex,night),Math.PI/8);
  parts.push({name:'ChimeHead',pivot:[0,0,0],geom:head,swing:null});
  C.tube.list.forEach((t,i)=>{const a=t.a*Math.PI/180,g=empty();prism(g,0,0,C.tube.r,C.tube.sides,0,-t.len,chimeColor(C.tube.hex,night),Math.PI/6);
    parts.push({name:'ChimeTube'+i,pivot:[C.tube.ring*Math.cos(a),C.tube.top,C.tube.ring*Math.sin(a)],geom:g,swing:{z:C.tubeSwing.z,x:C.tubeSwing.x,period:t.period,phase:t.phase}});});
  const S=C.string,s=empty();box(s,0,0,-S.len,S.w,chimeColor(S.hex,night));prism(s,0,0,S.clapperR,8,S.clapperY-S.top,S.clapperY-S.top-S.clapperH,chimeColor(S.clapperHex,night),Math.PI/8);
  const sail=empty();box(sail,0,-S.len,-S.len-S.sailH,S.sailW,chimeColor(S.sailHex,night));for(let i=2;i<sail.positions.length;i+=3)sail.positions[i]*=.08;   // flatten to a 2 pt board
  for(const k of ['positions','normals','colors'] as const)s[k].push(...sail[k]);const off=s.positions.length/3-sail.positions.length/3;s.indices.push(...sail.indices.map(i=>i+off));
  parts.push({name:'ChimeString',pivot:[0,S.top,0],geom:s,swing:S.swing});
  return parts;
}
/** Per-part swing (degrees about z, x) at time t; each part on its own period/phase, starts near rest. */
export function chimePartSwing(sw:ChimePart['swing'],t:number):[number,number]{
  if(!sw)return [0,0];const w=2*Math.PI/sw.period;return [sw.z*Math.sin(w*t+sw.phase),sw.x*Math.sin(w*.77*t+sw.phase*1.3)];
}
/** Triangle count (tests: stays low-poly). */
export function chimeTriangles(parts:ChimePart[]){return parts.reduce((n,p)=>n+p.geom.indices.length/3,0);}
