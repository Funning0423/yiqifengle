import type {Vec} from '../world-r1/WorldFlowCore';
import {MEADOW_LENS_VOX} from './MeadowLensVoxels';
import {MEADOW_LENS_BOXES} from './MeadowLensBoxes';
/** full8 P1-a: occupancy-grid clearance (meadow LOCAL space, data from tools/b1-lens/make_lens_voxels.cjs). Pure, no cc, ES5-safe. */
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function b64Bytes(s:string):Uint8Array{const n=s.replace(/=+$/,'').length,out=new Uint8Array(Math.floor(n*3/4));let o=0,acc=0,bits=0;
 for(let i=0;i<n;i++){acc=(acc<<6)|B64.indexOf(s.charAt(i));bits+=6;if(bits>=8){bits-=8;out[o++]=(acc>>bits)&255;}}return out;}
export type VoxGrid={size:number,origin:readonly number[],dims:readonly number[],bits:Uint8Array};
let meadowGrid:VoxGrid|null=null;
export function meadowVox():VoxGrid{if(!meadowGrid){const v=MEADOW_LENS_VOX;meadowGrid={size:v.size,origin:v.origin,dims:v.dims,bits:b64Bytes(v.bits)};}return meadowGrid;}
/** true when every occupied voxel is ≥ clr (box distance) from p. Outside the grid counts as clear. */
export function voxClear(g:VoxGrid,p:Vec,clr:number):boolean{const s=g.size,o=g.origin,N=g.dims;
 // only the cells overlapping the clr-ball's bounding box (≈27 cells for 1.1 m on a 1 m grid)
 const i0=Math.max(0,Math.floor((p[0]-clr-o[0])/s)),i1=Math.min(N[0]-1,Math.floor((p[0]+clr-o[0])/s)),j0=Math.max(0,Math.floor((p[1]-clr-o[1])/s)),j1=Math.min(N[1]-1,Math.floor((p[1]+clr-o[1])/s)),k0=Math.max(0,Math.floor((p[2]-clr-o[2])/s)),k1=Math.min(N[2]-1,Math.floor((p[2]+clr-o[2])/s));
 for(let k=k0;k<=k1;k++){for(let j=j0;j<=j1;j++){for(let i=i0;i<=i1;i++){
  const n=(k*N[1]+j)*N[0]+i;if(!(g.bits[n>>3]&(1<<(n&7))))continue;
  const x0=o[0]+i*s,y0=o[1]+j*s,z0=o[2]+k*s,dx=Math.max(x0-p[0],0,p[0]-x0-s),dy=Math.max(y0-p[1],0,p[1]-y0-s),dz=Math.max(z0-p[2],0,p[2]-z0-s);
  if(dx*dx+dy*dy+dz*dz<clr*clr)return false;}}}return true;}
/** World-space lens solid for the meadow node: toLocal = world → meadow local (node scale 1). */
export function meadowLensSolid(toLocal:(w:Vec)=>Vec):(w:Vec,clr:number)=>boolean{const g=meadowVox();return (w,clr)=>voxClear(g,toLocal(w),clr);}
/** The windmill SAIL sweep disc only (the sails turn; the grid holds one pose): world AABBs. */
export function sailSweepBoxesWorld(toWorld:(p:Vec)=>Vec):number[][]{const out:number[][]=[];for(const b of MEADOW_LENS_BOXES.windmill_sails){const m=[1e9,1e9,1e9],M=[-1e9,-1e9,-1e9];
 for(const x of[b[0],b[3]])for(const y of[b[1],b[4]])for(const z of[b[2],b[5]]){const w=toWorld([x,y,z]);for(let a=0;a<3;a++){m[a]=Math.min(m[a],w[a]);M[a]=Math.max(M[a],w[a]);}}out.push([m[0],m[1],m[2],M[0],M[1],M[2]]);}return out;}
