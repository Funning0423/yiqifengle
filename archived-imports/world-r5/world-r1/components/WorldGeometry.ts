import type { Vec } from './WorldFlowCore';
export type DoorGeometry={hinge:Vec;bounds:readonly (readonly[number,number])[]};
/** Exact point-to-oriented-box distance. +Y rotation maps leaf -X toward world +Z. */
export function doorDistance(point:Vec,angleDeg:number,door:DoorGeometry):number {
  const a=angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=point[0]-door.hinge[0],dz=point[2]-door.hinge[2];
  const local=[c*dx-s*dz,point[1]-door.hinge[1],s*dx+c*dz];
  return Math.hypot(...local.map((x,i)=>Math.max(door.bounds[i][0]-x,0,x-door.bounds[i][1])));
}
/** Conservative continuous lower bound using Lipschitz distance and sampled maximum travel.
 * Bound covers the whole piecewise-linear path and angle interpolation, including between samples.
 */
export function auditDoorTrack(points:readonly Vec[],fromDeg:number,toDeg:number,door:DoorGeometry,radius:number,steps=4096) {
  if(points.length<1||steps<1||radius<0)throw Error('Invalid audit');
  const lens=points.slice(1).map((p,i)=>Math.hypot(...p.map((x,j)=>x-points[i][j])));
  const total=lens.reduce((x,y)=>x+y,0);
  const reach=Math.hypot(Math.max(...door.bounds[0].map(Math.abs)),Math.max(...door.bounds[2].map(Math.abs)));
  const sample=(t:number):Vec=>{
    let left=total*t;for(let i=0;i<lens.length;i++){if(left<=lens[i]&&lens[i]>0)return points[i].map((x,j)=>x+(points[i+1][j]-x)*left/lens[i]) as unknown as Vec;left-=lens[i];}return points[points.length-1];
  };
  let min=Infinity,minT=0;
  for(let i=0;i<=steps;i++){const t=i/steps,d=doorDistance(sample(t),fromDeg+(toDeg-fromDeg)*t,door)-radius;if(d<min){min=d;minT=t;}}
  const betweenSamplesBound=(total+reach*Math.abs(toDeg-fromDeg)*Math.PI/180)/(2*steps);
  return {sampledMinimumClearanceM:min,conservativeMinimumClearanceM:min-betweenSamplesBound,minT,steps,radiusM:radius,betweenSamplesBoundM:betweenSamplesBound};
}
