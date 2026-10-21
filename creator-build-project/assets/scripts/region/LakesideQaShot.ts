import type {Pose, Vec} from '../world-r1/WorldFlowCore';
import {FreeOrbit, ORBIT_FEEL} from './FreeOrbit';
/** QA only (qaShot region 'lakeside'): phases of the b15 balloon → shore tail and the free-look reveal pose. Pure, no engine. */
export type LakesideQaPhase='door'|'walk'|'reveal';
/** QA tail marks in journey order. b16 fix (real-build qaShot reveal timeout): a mark only ever moves forward, so a late
 *  'out' (written after the door → board blend) can no longer overwrite 'shore'. */
export const LAKESIDE_QA_MARKS=['door','walk','out','shore'] as const;
export function lakesideQaAdvance(cur:unknown,next:string):string{const a=LAKESIDE_QA_MARKS.indexOf(cur as any),b=LAKESIDE_QA_MARKS.indexOf(next as any);return b>a?next:String(cur);}
export function lakesideQaPhase(v:unknown):LakesideQaPhase{return v==='walk'||v==='reveal'?v:'door';}
/** Which tail mark (published by RegionJourneyAdapter on globalThis.__qaLakeside.mark) each phase freezes after, and how long (s, game time). */
export const LAKESIDE_QA_FREEZE:Readonly<Record<LakesideQaPhase,{mark:'door'|'walk'|'out'|'shore';afterS:number}>>={door:{mark:'door',afterS:.9},walk:{mark:'out',afterS:1.2},reveal:{mark:'shore',afterS:.3}};
/** Moored balloon proxy (transport_balloon.glb bbox x/z ±2.9, y 0…10.4): envelope ellipsoid + basket corners, local to the basket origin. */
export function balloonProxy(at:Vec):Vec[]{
 const out:Vec[]=[];
 for(let i=0;i<8;i++)for(let j=0;j<=4;j++){const a=i/8*Math.PI*2,e=(j/4-.5)*Math.PI,c=Math.cos(e);out.push([at[0]+Math.cos(a)*c*2.9,at[1]+7.0+Math.sin(e)*3.4,at[2]+Math.sin(a)*c*2.9]);}
 for(const x of [-.8,.8])for(const z of [-.8,.8])for(const y of [0,1.2])out.push([at[0]+x,at[1]+y,at[2]+z]);
 return out;
}
function maxNdc(p:Pose,asp:number,pts:readonly Vec[]):number{
 const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],fl=Math.hypot(f[0],f[1],f[2])||1;f[0]/=fl;f[1]/=fl;f[2]/=fl;
 let r=[-f[2],0,f[0]];const rl=Math.hypot(r[0],r[2])||1;r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const th=Math.tan((p.fovVerticalDeg||48)*Math.PI/360);let m=0;
 for(let i=0;i<pts.length;i++){const q=pts[i],v=[q[0]-p.position[0],q[1]-p.position[1],q[2]-p.position[2]],z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];if(z<.2)return 99;
  m=Math.max(m,Math.abs((v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*asp)),Math.abs((v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/(z*th)));}
 return m;
}
function ndcY(p:Pose,q:Vec):number{
 const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],fl=Math.hypot(f[0],f[1],f[2])||1;f[0]/=fl;f[1]/=fl;f[2]/=fl;
 let r=[-f[2],0,f[0]];const rl=Math.hypot(r[0],r[2])||1;r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const v=[q[0]-p.position[0],q[1]-p.position[1],q[2]-p.position[2]],z=Math.max(.2,v[0]*f[0]+v[1]*f[1]+v[2]*f[2]);
 return (v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/(z*Math.tan((p.fovVerticalDeg||48)*Math.PI/360));
}
/** Composition (b15 review of c_reveal): subject block (balloon top … her feet) vertically centred, and little empty
 *  foreground below her feet. 0 = ideal. Weights chosen so that ~0.1 NDC of imbalance costs about as much as 6 degrees of drag. */
export function lakesideRevealComposition(p:Pose,feet:Vec,balloon:Vec):{centre:number;emptyBelow:number;cost:number}{
 const top=ndcY(p,[balloon[0],balloon[1]+10.4,balloon[2]]),bot=Math.min(ndcY(p,[feet[0],feet[1],feet[2]]),ndcY(p,[balloon[0],balloon[1],balloon[2]]));
 const centre=(top+bot)/2,emptyBelow=(bot+1)/2;
 return {centre,emptyBelow,cost:60*Math.abs(centre)+80*Math.max(0,emptyBelow-.2)};
}
/** Samples whose line of sight is tested: the balloon proxy and her body (lifted 0.1 m off the ground). */
export function lakesideRevealSamples(feet:Vec,balloon:Vec):Vec[]{
 const her:Vec[]=[];for(const y of [.1,.5,.9,1.3,1.65])for(const dx of [-.25,0,.25])her.push([feet[0]+dx,feet[1]+y,feet[2]]);
 return balloonProxy(balloon).concat(her);
}
export type LakesideOccluder=(from:Vec,to:Vec)=>boolean;
/** Scene ray: distance to the first surface along unit `dir` within maxM, and whether that surface is ground (null = no hit). */
export type LakesideEdgeRay=(from:Vec,dir:Vec,maxM:number)=>{t:number;ground:boolean}|null;
/** Edge rule (b16): a near object (tree, house) within nearM of the lens must not be cut by the left, right or top frame
 *  edge. Rays along each edge (just inside, NDC ±0.99) and just outside (±1.06) are cast; a non-ground hit within nearM on
 *  either side of the edge means the object straddles it. Ground and far scenery (> nearM) are allowed. */
export const LAKESIDE_REVEAL_EDGE={nearM:12,inside:.99,outside:1.06,samples:9} as const;
export function lakesideEdgeCut(p:Pose,aspect:number,ray:LakesideEdgeRay,k=LAKESIDE_REVEAL_EDGE):number{
 const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],fl=Math.hypot(f[0],f[1],f[2])||1;f[0]/=fl;f[1]/=fl;f[2]/=fl;
 let r=[-f[2],0,f[0]];const rl=Math.hypot(r[0],r[2])||1;r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const th=Math.tan((p.fovVerticalDeg||48)*Math.PI/360);let cut=0;
 const near=(x:number,y:number)=>{const d:Vec=[f[0]+r[0]*x*th*aspect+u[0]*y*th,f[1]+r[1]*x*th*aspect+u[1]*y*th,f[2]+r[2]*x*th*aspect+u[2]*y*th],l=Math.hypot(d[0],d[1],d[2]);
  const h=ray(p.position,[d[0]/l,d[1]/l,d[2]/l],k.nearM);return !!h&&!h.ground;};
 for(let i=0;i<k.samples;i++){const s=-.6+1.58*i/(k.samples-1),x=-1+2*i/(k.samples-1);
  for(const sg of [-1,1])if(near(sg*k.inside,s)||near(sg*k.outside,s))cut++;
  if(near(x,k.inside)||near(x,k.outside))cut++;}
 return cut;
}
/** Free look on the lakeside orbit (revealWiden, seedAimBlend) from `board`: among drags that frame the balloon + her inside
 *  `fit` and (when `occluded` is given, e.g. a scene raycast) keep at most `maxOccluded` of the sight samples blocked, the one
 *  with the lowest drag + composition cost. Returns the orbit pose after that drag (as a player's drag would give), or null. */
export function lakesideRevealPose(board:Pose,feet:Vec,balloon:Vec,aspect:number,fit=.98,occluded?:LakesideOccluder,maxOccluded=.03,edgeRay?:LakesideEdgeRay):{pose:Pose;yawDeg:number;pitchDeg:number;distM:number;maxNdc:number;occludedFrac:number;edgeCuts:number;composition:{centre:number;emptyBelow:number;cost:number}}|null{
 const her:Vec[]=[[feet[0],feet[1],feet[2]],[feet[0],feet[1]+1.65,feet[2]]],pts=balloonProxy(balloon).concat(her),sight=lakesideRevealSamples(feet,balloon);
 let best:any=null;
 // b16: distance is searched too (seeded distance … distMax, pinch out); the nearest passing distance is preferred
 const o0=new FreeOrbit('lakeside');o0.seed(board,feet);const d0=(o0 as any).dist as number,dMax=o0.limitsOf().distMax,dists:number[]=[];
 for(let d=d0;d<=dMax+1e-6;d+=.75)dists.push(Math.min(d,dMax));
 for(const D of dists)for(const sgn of [1,-1])for(let dy=0;dy<=230;dy+=2)for(let dp=-48;dp<=48;dp+=2){
  const o=new FreeOrbit('lakeside');o.seed(board,feet);if(D>d0+1e-3)o.pinch(d0/D);
  // drag in small steps so seedAimBlend sees the accumulated input exactly as a finger would
  const n=Math.max(1,Math.ceil(Math.max(dy,Math.abs(dp))/2));for(let k=0;k<n;k++)o.drag(sgn*dy/n/ORBIT_FEEL.yawPerScreen,dp/n/ORBIT_FEEL.pitchPerScreen);
  const p=o.rawPose(feet);if(p.position[1]<feet[1]+.5)continue;const m=maxNdc(p,aspect,pts);if(m>fit)continue;
  const comp=lakesideRevealComposition(p,feet,balloon),c=dy*.15+Math.abs(dp)*.05+comp.cost+(D-d0)*6;if(best&&c>=best.c)continue;
  let occ=0;if(occluded){for(let i=0;i<sight.length;i++)if(occluded(p.position,sight[i]))occ++;occ/=sight.length;if(occ>maxOccluded)continue;}
  const cuts=edgeRay?lakesideEdgeCut(p,aspect,edgeRay):0;if(cuts>0)continue;
  best={pose:p,yawDeg:sgn*dy,pitchDeg:-dp,distM:D,maxNdc:m,occludedFrac:occ,edgeCuts:cuts,composition:comp,c};}
 return best?{pose:best.pose,yawDeg:best.yawDeg,pitchDeg:best.pitchDeg,distM:best.distM,maxNdc:best.maxNdc,occludedFrac:best.occludedFrac,edgeCuts:best.edgeCuts,composition:best.composition}:null;
}
