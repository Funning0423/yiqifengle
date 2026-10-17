import type {Vec} from '../world-r1/WorldFlowCore';

/** Meadow-local layout from art/landing_layout.json (GBT 2026-10-18). Parent under the journey meadow root. */
export const SAIL_LANDING_SEA_LOCAL=0.44;
export const SAIL_LANDING_DECK_LOCAL=0.75;
export const SAIL_LANDING_JETTY_ROOT:Vec=[1.0,0.75,23.2];
export const SAIL_LANDING_BERTH_LOCAL:Vec=[2.7,0.44,30.3];
export const SAIL_LANDING_STEP_LOCAL:Vec=[1.35,0.75,30.37];
/** Port-side mirror of board_step_anchor (−0.62 → +0.62). */
export const SAIL_PORT_STEP_LOCAL:Vec=[0.62,0.60,-0.07];
/** Author keypoints from landing_layout.json; runtime walk densifies to ≤1.5 m. */
export const SAIL_LANDING_WALK_KEYS:readonly Vec[]=[
 [1.0,0.75,30.37],
 [1.0,0.75,27.2],
 [1.0,0.75,23.2],
 [0.927,0.874,21.924],
 [0.823,1.035,20.71],
 [0.857,1.226,19.549],
 [1.198,1.35,18.448],
];
function densify(path:readonly Vec[],maxStep=1.5):Vec[]{
 const out:Vec[]=[path[0]];
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i];
  const d=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
  const n=Math.max(1,Math.ceil(d/maxStep));
  for(let k=1;k<=n;k++){
   const t=k/n;
   out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);
  }
 }
 return out;
}
export const SAIL_LANDING_WALK_LOCAL:readonly Vec[]=densify(SAIL_LANDING_WALK_KEYS,1.45);
export const SAIL_PATH_JOIN_ROW:readonly Vec[]=[
 [-0.028,1.412,18.382],
 [2.424,1.288,18.514],
];
export const SAIL_GRASS_CLEAR_MARGIN=0.3;
export const SAIL_GRASS_CLEAR_POLYS:{path_strip:readonly [number,number][];jetty:readonly [number,number][]}={
 path_strip:[
  [-0.028,18.382],[-0.238,18.188],[-0.523,18.535],[-0.725,18.915],[-0.828,19.312],[-0.829,19.708],
  [-0.735,20.088],[-0.561,20.443],[-0.332,20.772],[-0.113,21.083],[-0.046,21.395],[0.022,21.701],
  [0.085,22.003],[0.141,22.302],[0.185,22.597],[0.215,22.89],[0.225,23.18],[1.775,23.18],
  [1.774,22.835],[1.771,22.497],[1.769,22.166],[1.769,21.844],[1.774,21.531],[1.783,21.227],
  [1.799,20.935],[1.823,20.657],[1.855,20.394],[1.896,20.147],[1.945,19.919],[2.002,19.71],
  [2.066,19.518],[2.134,19.341],[2.208,19.175],[2.424,18.514],
 ],
 jetty:[[0.18,23.0],[1.82,23.0],[1.82,31.2],[0.18,31.2]],
};
/** Arrival walk budget after she steps onto the jetty (not part of the 30.5 s sail). */
export const SAIL_ARRIVAL_WALK_LIMIT_S=12;
export const SAIL_ARRIVAL_WALK_MPS=1.2;

export function meadowLocalToWorld(p:Vec,root:Vec):Vec{return [root[0]-p[0],root[1]+p[1],root[2]-p[2]];}
export function pointInPolyXZ(x:number,z:number,poly:readonly [number,number][]):boolean{
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const xi=poly[i][0],zi=poly[i][1],xj=poly[j][0],zj=poly[j][1];
  if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/((zj-zi)||1e-12)+xi))inside=!inside;
 }
 return inside;
}
export function expandPolyXZ(poly:readonly [number,number][],margin:number):[number,number][]{
 if(margin<=0)return poly.map(p=>[p[0],p[1]]);
 let cx=0,cz=0;
 for(const p of poly){cx+=p[0];cz+=p[1];}
 cx/=poly.length;cz/=poly.length;
 return poly.map(([x,z])=>{
  const dx=x-cx,dz=z-cz,L=Math.hypot(dx,dz)||1;
  return [x+dx/L*margin,z+dz/L*margin] as [number,number];
 });
}
export function inGrassClearLocal(x:number,z:number):boolean{
 const m=SAIL_GRASS_CLEAR_MARGIN;
 return pointInPolyXZ(x,z,expandPolyXZ(SAIL_GRASS_CLEAR_POLYS.path_strip,m))
  ||pointInPolyXZ(x,z,expandPolyXZ(SAIL_GRASS_CLEAR_POLYS.jetty,m));
}
export function polyLen(path:readonly Vec[]):number{
 let L=0;for(let i=1;i<path.length;i++)L+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1],path[i][2]-path[i-1][2]);
 return L;
}
/** Jetty walk only (landing_walk_00…06). */
export function sailArrivalWalkM():number{return polyLen(SAIL_LANDING_WALK_LOCAL);}
export function sailArrivalWalkS():number{return sailArrivalWalkM()/SAIL_ARRIVAL_WALK_MPS;}
