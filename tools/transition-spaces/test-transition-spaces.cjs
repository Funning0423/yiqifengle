'use strict';
// scene/b19-transition-spaces: offline checks of tools/transition-spaces/stances.json against the d9423886 geometry.
// 1 walkable points are on RegionWalkable cells (floor y within 0.15 m) and walkable→walkable legs pass lineWalkable;
// 2 dock / ramp / gangway / deck / basket points sit on their declared (planned) top surfaces;
// 3 her body column (r 0.17 m, foot+0.25…1.5 m) along every leg touches no existing triangle (region crops, boat, basket,
//   door leaf in its open pose); 4 door sweep misses her; 5 planned surfaces meet the ground (no float, nothing pokes through);
// 6 parked baskets / envelopes clear the scenery (meadow incl. the windmill sail disc); 7 rerouted edges avoid the basket.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {load}=require('../region-nodes/load.cjs');const RW=load('region/RegionWalkable.ts');
const glb=require('../journey-integration/occlusion/lib-glb.cjs');
const H=__dirname,J=JSON.parse(fs.readFileSync(path.join(H,'stances.json'),'utf8')),S=J.segments;
const BUN=path.join(H,'../../creator-build-project/assets/bundles/');
const fx=n=>{const d=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(H,'fixtures',n+'.json.gz'))).toString());const T=[];for(const v of Object.values(d))for(let k=0;k<v.length;k+=9)T.push(v.slice(k,k+9));return T;};
const meshOf=(file,re)=>{const T=[];for(const n of glb.load(BUN+file)){if(!n.tris||!re.test(n.name))continue;for(let k=0;k<n.tris.length;k+=9)T.push(Array.from(n.tris.slice(k,k+9)));}return T;};
const R={island:fx('island'),meadow:fx('meadow_n').concat(fx('meadow_s')),skycity:fx('sky_s0').concat(fx('sky_s6'),fx('sky_s6w'))};
const BOAT=meshOf('transport_sail/sailboat.glb',/^(hull|rig|seat_bench)$/),BASK=meshOf('region_transit_balloon/transport_balloon.glb',/^balloon_basket$/),LEAF=meshOf('region_transit_balloon/transport_balloon.glb',/^basket_door_leaf$/);
const JETTY=meshOf('transport_sail/transit_landing.glb',/^landing_jetty$/);
let fails=0,checks=0;const ok=(c,m)=>{checks++;if(!c){fails++;console.error('FAIL '+m);}};
const rot=(deg,p)=>{const c=Math.cos(deg*Math.PI/180),s=Math.sin(deg*Math.PI/180);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
const xf=(root,yaw,p)=>{const q=rot(yaw,p);return [root[0]+q[0],root[1]+q[1],root[2]+q[2]];};
const xfT=(T,root,yaw)=>T.map(t=>[...xf(root,yaw,t.slice(0,3)),...xf(root,yaw,t.slice(3,6)),...xf(root,yaw,t.slice(6,9))]);
const leafOpen=(deg)=>LEAF.map(t=>{const o=[];for(let i=0;i<9;i+=3){const p=[t[i]-.4,t[i+1],t[i+2]-.84],q=rot(deg,p);o.push(q[0]+.4,q[1],q[2]+.84);}return o;});
// box-triangle overlap (SAT)
function boxTri(c,h,t){const v=[[t[0]-c[0],t[1]-c[1],t[2]-c[2]],[t[3]-c[0],t[4]-c[1],t[5]-c[2]],[t[6]-c[0],t[7]-c[1],t[8]-c[2]]];
 for(let a=0;a<3;a++){const mn=Math.min(v[0][a],v[1][a],v[2][a]),mx=Math.max(v[0][a],v[1][a],v[2][a]);if(mn>h[a]||mx<-h[a])return false;}
 const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dt=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const e=[sub(v[1],v[0]),sub(v[2],v[1]),sub(v[0],v[2])],n=cr(e[0],e[1]);const rn=h[0]*Math.abs(n[0])+h[1]*Math.abs(n[1])+h[2]*Math.abs(n[2]);if(Math.abs(dt(n,v[0]))>rn)return false;
 const ax=[[1,0,0],[0,1,0],[0,0,1]];for(const ei of e)for(const u of ax){const a=cr(u,ei);if(dt(a,a)<1e-12)continue;const p=v.map(x=>dt(x,a)),r=h[0]*Math.abs(a[0])+h[1]*Math.abs(a[1])+h[2]*Math.abs(a[2]);if(Math.min(...p)>r||Math.max(...p)<-r)return false;}
 return true;}
const bodyHits=(T,p,lo=.25,hi=1.5,r=.17)=>{const c=[p[0],p[1]+(lo+hi)/2,p[2]],h=[r,(hi-lo)/2,r];let n=0;for(const t of T){if(Math.max(t[0],t[3],t[6])<c[0]-r||Math.min(t[0],t[3],t[6])>c[0]+r||Math.max(t[2],t[5],t[8])<c[2]-r||Math.min(t[2],t[5],t[8])>c[2]+r)continue;if(boxTri(c,h,t))n++;}return n;};
const legs=(pts,step=.1)=>{const o=[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],L=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),n=Math.max(1,Math.ceil(L/step));for(let k=0;k<=n;k++){const u=k/n;o.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]);}}return o;};
const floorAt=(T,x,z,ref,up=.3)=>{let best=null;for(const t of T){const ax=t[0],az=t[2],bx=t[3],bz=t[5],cx=t[6],cz=t[8];if(x<Math.min(ax,bx,cx)||x>Math.max(ax,bx,cx)||z<Math.min(az,bz,cz)||z>Math.max(az,bz,cz))continue;
 const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;if(l1<-1e-6||l2<-1e-6||l3<-1e-6)continue;const y=l1*t[1]+l2*t[4]+l3*t[7];if(y<=ref+up&&(best===null||y>best))best=y;}return best;};
// ---------- 1 + 2: per-point surfaces ----------
for(const [id,seg] of Object.entries(S)){
 for(const p of seg.path){const s=p.surface;
  if(s.startsWith('walkable:')){const reg=s.slice(9),y=RW.walkFloorY(reg,p.at[0],p.at[2]);ok(y!==null,`${id}/${p.id} walkable on ${reg} (${p.at})`);if(y!==null)ok(Math.abs(y-p.at[1])<=.15,`${id}/${p.id} foot y ${p.at[1]} vs floor ${y.toFixed(3)}`);}
 }
 const wk=seg.path.filter(p=>p.surface.startsWith('walkable:'));
 for(let i=1;i<wk.length;i++){const a=wk[i-1],b=wk[i];if(a.surface!==b.surface||(a.existing&&b.existing))continue;const ia=seg.path.indexOf(a),ib=seg.path.indexOf(b);if(ib!==ia+1)continue;ok(RW.lineWalkable(a.surface.slice(9),a.at,b.at),`${id} leg ${a.id}->${b.id} lineWalkable`);}
}
// island dock
{const s=S['1_island_board'],D=s.nodes.dock,B=s.boatAtBerth;
 for(const p of s.path){if(p.surface==='dock'){ok(p.at[0]>=D.deck.x[0]&&p.at[0]<=D.deck.x[1]&&p.at[2]>=D.deck.z[0]&&p.at[2]<=D.deck.z[1]&&Math.abs(p.at[1]-D.deck.topY)<.01,`dock point ${p.id} on island_dock_deck`);}
  if(p.surface==='dock_ramp'){const u=(p.at[2]-D.ramp.z[0])/(D.ramp.z[1]-D.ramp.z[0]);ok(Math.abs(p.at[1]-(D.ramp.topY[0]+(D.ramp.topY[1]-D.ramp.topY[0])*u))<.02,`ramp point ${p.id}`);}}
 // 5: nothing of the island pokes through the deck/ramp top, and the ramp's upper end meets the ground
 let worst=-9;for(let x=D.deck.x[0];x<=D.deck.x[1]+1e-6;x+=.1)for(let z=D.deck.z[0];z<=D.deck.z[1]+1e-6;z+=.1){const g=floorAt(R.island,x,z,D.deck.topY,.6);if(g!==null)worst=Math.max(worst,g-D.deck.topY);}
 ok(worst<=-.03,`island under island_dock_deck stays ≥3 cm below its top (worst ${worst.toFixed(3)})`);
 for(let x=D.ramp.x[0];x<=D.ramp.x[1]+1e-6;x+=.1){const g=floorAt(R.island,x,D.ramp.z[0],0,.5);ok(g!==null&&g<=D.ramp.topY[0]+.02&&g>=D.ramp.topY[0]-(D.ramp.skirt?.3:.06),`ramp top edge meets ground at x ${x.toFixed(1)} (ground ${g&&g.toFixed(3)})`);
  for(let z=D.ramp.z[0];z<=D.ramp.z[1];z+=.1){const u=(z-D.ramp.z[0])/(D.ramp.z[1]-D.ramp.z[0]),top=D.ramp.topY[0]+(D.ramp.topY[1]-D.ramp.topY[0])*u,g2=floorAt(R.island,x,z,top,.5);ok(g2===null||g2<=top+.02,`ramp clear of terrain at ${x.toFixed(1)},${z.toFixed(1)} (ground ${g2&&g2.toFixed(3)} top ${top.toFixed(3)})`);}}
 // gangway geometry: dock edge vs hull; plank ends on both supports
 const hullX=B.pos[0]-0.8;ok(D.deck.x[1]<hullX-.1,`dock edge ${D.deck.x[1]} keeps ≥0.1 m off the hull (${hullX.toFixed(2)})`);
 const pd=s.path.find(p=>p.id==='dock_board');ok(pd.at[0]>=D.deck.x[0]&&pd.at[0]<=D.deck.x[1]-.1&&Math.abs(pd.at[1]-(D.deck.topY+.04))<.02,'gangway outer end rests ≥0.1 m on the deck (plank top = deck + 0.04)');
 // body clearance: island part vs the island crop; boat part vs the boat (boat-local)
 const isl=s.path.filter(p=>p.frame==='island');let hi=0;for(let i=1;i<isl.length;i++){if(isl[i-1].existing&&isl[i].existing)continue;for(const q of legs([isl[i-1].at,isl[i].at]))hi+=bodyHits(R.island,q);}ok(hi===0,`seg1 island walk body clear (${hi} hits)`);
 const bp=s.path.filter(p=>p.frame==='boat'||p.boatLocal).map(p=>p.boatLocal||p.at);let hb=0;for(const q of legs(bp))hb+=bodyHits(BOAT,q,.3);ok(hb===0,`seg1 boat walk body clear of hull/rig/bench (${hb} hits)`);
 // gunwale under the rail point (feet on the plank, not in the hull)
 const g=floorAt(BOAT,-0.70,-0.07,.6,.2);ok(g!==null&&g<=.56+.02,`gunwale under sail_gangway_hinge ≤ 0.58 (got ${g&&g.toFixed(3)})`);
 const sole=floorAt(BOAT,-0.2,-0.07,.06,.05);ok(sole!==null&&Math.abs(sole-.06)<.02,`cockpit sole at 0.06 (got ${sole&&sole.toFixed(3)})`);
}
// meadow landing
{const s=S['2_meadow_landing'];const bp=s.path.filter(p=>p.frame==='boat'&&p.id!=='boat_seated').map(p=>p.at);let hb=0;for(const q of legs(bp))hb+=bodyHits(BOAT,q,.3);ok(hb===0,`seg2 boat walk clear (${hb})`);
 const mp=s.path.filter(p=>p.regionAt).map(p=>p.regionAt),pj=s.path.find(p=>p.id==='boat_plank_jetty').regionAt;
 const jt=floorAt(JETTY,pj[0],pj[2],1.0,.3);ok(jt!==null&&Math.abs(pj[1]-.04-jt)<.03,`gangway outer end rests on landing_jetty (plank ${pj[1]} jetty ${jt&&jt.toFixed(3)})`);
 const hullIn=s.boatAtBerth.meadowPos[0]-0.8;ok(hullIn>1.843,`boat hull (${hullIn.toFixed(2)}) clear of the jetty edge 1.843`);
 const jw=s.path.filter(p=>p.frame==='meadow').map(p=>p.at);let hj=0;for(const q of legs([pj,...jw]))hj+=bodyHits(JETTY,q,.3)+bodyHits(R.meadow,q,.3);ok(hj===0,`seg2 jetty/path walk clear (${hj})`);
}
// ---------- balloon segments ----------
const BK=Object.values(S).find(s=>s.basket).basket,DOOR=Object.values(S).find(s=>s.door).door;
const doorSweepClear=(p)=>Math.hypot(p[0]-DOOR.hingeBasket[0],p[2]-DOOR.hingeBasket[2])-DOOR.leafRadiusM-.17;
ok(doorSweepClear(BK.outside)>=.05,`basket_outside clear of the outward door sweep (${doorSweepClear(BK.outside).toFixed(3)} m)`);
ok(Math.hypot(BK.P0[0]-BK.seat[0],BK.P0[2]-BK.seat[2])>.49&&Math.hypot(BK.P0[0]-BK.seat[0],BK.P0[2]-BK.seat[2])<.5,'seat -> P0 = stand_up / sit_down root travel 0.494 m');
{const open=leafOpen(DOOR.openDeg),inside=[BK.doorOut,BK.threshold,BK.P0,BK.seat];let h=0;for(const q of legs(inside))h+=bodyHits(BASK.concat(open),q,.3);ok(h===0,`walk in/out through the open door clear of basket + open leaf (${h})`);
 let hs=0;for(const q of legs([BK.outside,BK.doorOut]))hs+=bodyHits(open,q,.05);ok(hs===0,`outside -> door_out clear of the open leaf (${hs})`);}
{const s=S['3_meadow_balloon_in'],st=s.stool,b=s.balloon,p=s.path.find(q=>q.id==='balloon_step_stool'),o=s.path.find(q=>q.id==='basket_door_out');
 ok(p.at[1]-o.at[1]<=.07&&b.root[1]-p.at[1]<=.07&&p.at[1]>o.at[1],`stool splits the door step (${(p.at[1]-o.at[1]).toFixed(3)} + ${(b.root[1]-p.at[1]).toFixed(3)} m)`);
 let gmax=-9;for(let x=st.basketLocal.x[0];x<=st.basketLocal.x[1]+1e-6;x+=.05)for(let z=st.basketLocal.z[0];z<=st.basketLocal.z[1]+1e-6;z+=.05){const q=xf(b.root,b.yawDeg,[x,0,z]),g=floorAt(R.meadow,q[0],q[2],st.topY,.3);if(g!==null)gmax=Math.max(gmax,g);}
 ok(gmax<st.topY,`lawn under balloon_step_stool below its top (max ${gmax.toFixed(3)})`);
 let lowLeaf=9;for(let a=0;a<=100;a+=5)for(const t of leafOpen(a))for(let i=0;i<9;i+=3){const x=t[i],z=t[i+2];if(x>=st.basketLocal.x[0]&&x<=st.basketLocal.x[1]&&z>=st.basketLocal.z[0]&&z<=st.basketLocal.z[1])lowLeaf=Math.min(lowLeaf,b.root[1]+t[i+1]);}
 ok(lowLeaf-st.topY>=.03,`door leaf clears the stool while swinging (${(lowLeaf-st.topY).toFixed(3)} m)`);}
// envelope profile (from the glb)
const ENV=meshOf('region_transit_balloon/transport_balloon.glb',/^balloon_envelope$/);const prof=(T=>{const prof=[];for(let y=2.9;y<=10.5+1e-6;y+=.1){let m=0;for(let k=0;k+9<=T.length;k+=9)for(const [a,b] of [[0,3],[3,6],[6,0]]){const ya=T[k+a+1],yb=T[k+b+1];if((ya-y)*(yb-y)>0||ya===yb){if(Math.abs(ya-y)<.05)m=Math.max(m,Math.hypot(T[k+a],T[k+a+2]));continue;}const u=(y-ya)/(yb-ya);m=Math.max(m,Math.hypot(T[k+a]+(T[k+b]-T[k+a])*u,T[k+a+2]+(T[k+b+2]-T[k+a+2])*u));}prof.push(m);}return prof;})(ENV.flat()).map((m,i)=>[2.9+i*.1,m]);/* edge-crossing radius (b19 fix: vertex rings left 0-radius gaps) */
const envR=h=>{if(h<2.9||h>10.5)return 0;const i=Math.min(prof.length-1,Math.round((h-2.9)/.1));return prof[i][1];};
function parkClear(T,root,extra=[]){let worst=9;const P=[];for(const t of T){for(let i=0;i<9;i+=3)P.push([t[i],t[i+1],t[i+2]]);P.push([(t[0]+t[3]+t[6])/3,(t[1]+t[4]+t[7])/3,(t[2]+t[5]+t[8])/3]);}for(const p of extra)P.push(p);
 for(const p of P){const h=p[1]-root[1],d=Math.hypot(p[0]-root[0],p[2]-root[2]);const r=Math.max(envR(h),h>.02&&h<1.25?.96:0);if(r>0)worst=Math.min(worst,d-r);}return worst;}
{const s=S['3_meadow_balloon_in'],b=s.balloon;const disc=[];for(let a=0;a<6.283;a+=.07)for(let rr=.3;rr<=6.25;rr+=.25)disc.push([rr*Math.cos(a),13.66+rr*Math.sin(a),-27.0]);
 const terr=R.meadow;const nonFloor=fx('meadow_n');// all crop tris incl. fence/bell/windmill; terrain filtered by height test below
 const w=parkClear(nonFloor.filter(t=>Math.max(t[1],t[4],t[7])>b.root[1]+.02),b.root,disc);ok(w>=.3,`meadow parked balloon (basket + envelope + windmill sail disc) clearance ${w.toFixed(2)} ≥ 0.3`);
 const wq=parkClear(nonFloor.filter(t=>Math.max(t[1],t[4],t[7])>b.requested[1]+.02),b.requested,disc);ok(wq<0,`requested (4.6,-24.2) really collides (clearance ${wq.toFixed(2)}) — reason for the move`);
 let lo=9,hi=-9;for(let a=0;a<6.283;a+=.4){const g=floorAt(terr,b.root[0]+.94*Math.cos(a),b.root[2]+.94*Math.sin(a),7,.6);lo=Math.min(lo,g);hi=Math.max(hi,g);}
 ok(hi<=b.root[1]-.03+.005&&lo>=b.root[1]-.03-.1,`meadow basket board bottom ${(b.root[1]-.03).toFixed(3)} on the lawn (${lo.toFixed(3)}..${hi.toFixed(3)})`);
 const mw=s.path.filter(p=>p.frame==='meadow').map(p=>p.at);let h=0;for(const q of legs(mw))h+=bodyHits(R.meadow,q);ok(h===0,`seg3 approach body clear (${h})`);
 for(const c of s.walkableChanges.filter(c=>c.kind==='reroute-edge')){for(let i=1;i<c.path.length;i++)ok(RW.lineWalkable('meadow',c.path[i-1],c.path[i]),`meadow reroute ${c.edge} leg ${i} walkable`);
  for(const q of legs(c.path,.2))ok(Math.hypot(q[0]-b.root[0],q[2]-b.root[2])>=1.25,`meadow reroute ${c.edge} keeps 1.25 m off the basket at ${q.map(v=>v.toFixed(1))}`);}}
{const s=S['4_skycity_balloon_out'],b=s.balloon,dk=s.deck;
 const w=parkClear(R.skycity.filter(t=>Math.max(t[1],t[4],t[7])>b.root[1]+.02),b.root);ok(w>=.3,`skycity landing basket+envelope clearance ${w.toFixed(2)}`);
 let gmax=-9;for(let x=dk.sizeBasketLocal.x[0];x<=dk.sizeBasketLocal.x[1];x+=.2)for(let z=dk.sizeBasketLocal.z[0];z<=dk.sizeBasketLocal.z[1];z+=.2){const p=xf(b.root,b.yawDeg,[x,0,z]),g=floorAt(R.skycity,p[0],p[2],0,.4);if(g!==null)gmax=Math.max(gmax,g);}
 ok(gmax<=dk.topY-.02,`ground under sky_mooring_deck ≤ top-0.02 (max ${gmax.toFixed(3)} top ${dk.topY})`);
 const fe=xf(b.root,b.yawDeg,[0,0,dk.sizeBasketLocal.z[1]]),gf=floorAt(R.skycity,fe[0],fe[2],0,.4);ok(gf!==null&&dk.topY-gf<=.08,`deck front edge step ${(dk.topY-gf).toFixed(3)} m ≤ 0.08 (bevelled)`);
 const pts=s.path.filter(p=>p.frame==='skycity');for(const p of pts.filter(p=>p.surface==='deck')){const l=rot(-b.yawDeg,[p.at[0]-b.root[0],0,p.at[2]-b.root[2]]);ok(l[0]>=dk.sizeBasketLocal.x[0]&&l[0]<=dk.sizeBasketLocal.x[1]&&l[2]<=dk.sizeBasketLocal.z[1]+1e-3&&Math.abs(p.at[1]-dk.topY)<.01,`${p.id} on the deck`);}
 const P0=s.path.find(p=>p.id==='basket_P0').regionAt;ok(Math.abs(P0[1]-(b.root[1]))<.01,'P0 on the basket floor board');
 const sd=s.path.find(p=>p.id==='stepdown_end');ok(Math.abs(Math.hypot(sd.at[0]-P0[0],sd.at[2]-P0[2])-1.1566)<.01,'step-down covers walk_start_stepdown forwardEnd 1.157 m');
 let h=0;for(const q of legs([P0,...pts.map(p=>p.at)]))h+=bodyHits(R.skycity,q);ok(h===0,`seg4 walk-out body clear (${h})`);}
{const s=S['5a_skycity_balloon_in'],b=s.balloon;
 const w=parkClear(R.skycity.filter(t=>Math.max(t[1],t[4],t[7])>b.root[1]+.02),b.root);if(w>=.5)ok(true,`seg5a C1 parked clearance ${w.toFixed(2)}`);else{const rec=b.parkedClearance;ok(rec&&rec.status==='BLOCKED'&&Math.abs(rec.minGapM-w)<.05,`seg5a C1 parked clearance ${w.toFixed(2)} < 0.5 is recorded as BLOCKED in stances.json (${rec&&rec.minGapM})`);console.log(`WARN seg5a C1 parked basket+envelope gap ${w.toFixed(2)} m < 0.5 (product decision pending)`);};
 // door leaf sweeping over the floor must not scrape it
 let worst=9;for(let a=0;a<=100;a+=5){for(const t of leafOpen(a))for(let i=0;i<9;i+=3){const p=xf(b.root,b.yawDeg,[t[i],t[i+1],t[i+2]]);const g=floorAt(R.skycity,p[0],p[2],p[1],.2);if(g!==null)worst=Math.min(worst,p[1]-g);}}
 ok(worst>=.005,`open door leaf stays above the island floor (min gap ${worst.toFixed(3)})`);
 const th=s.path.find(p=>p.id==='basket_threshold').at,gt=floorAt(R.skycity,th[0],th[2],.2,.3);ok(gt===null||Math.abs(gt-b.root[1])<=.05,`threshold step ${(gt===null?'over the edge':(b.root[1]-gt).toFixed(3))}`);
 const pts=s.path.filter(p=>p.frame==='skycity').map(p=>p.at);let h=0;const hl=[];for(const q of legs(pts)){const n=bodyHits(R.skycity,q);if(n)hl.push(q.map(v=>v.toFixed(2)).join(','));h+=n;}ok(h===0,`seg5a approach body clear (${h}) ${hl.slice(0,4).join(' | ')}`);}
// seg5a lift-off: parked + suggested lift (lift5-suggested.json) keep ≥ 0.5 m with the edge-crossing envelope (check-lift-clearance.cjs on fixtures)
{const CL=require('./check-lift-clearance.cjs'),raw=n=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(H,'fixtures',n+'.json.gz'))).toString());
 const sc={};for(const n of ['sky_s6w','sky_lift5'])for(const [k,v] of Object.entries(raw(n)))sc[k]=(sc[k]||[]).concat(v);
 const b=S['5a_skycity_balloon_in'].balloon,lk=S['5a_skycity_balloon_in'].liftSuggested;ok(!!lk&&lk.keys.length>=5,'seg5a has a suggested lift (≥5 keys)');
 const env=ENV.flat();const pk=CL.check({keys:[{t:0,pos:b.root}]},{dt:1,scene:sc,envelope:env,box:'fx'});ok(pk.minGapM>=.5,`seg5a parked gap ${pk.minGapM} ≥ 0.5 (${pk.hit})`);
 const lr=CL.check(lk,{dt:.02,scene:sc,envelope:env,box:'fx'});ok(lr.minGapM>=.5,`seg5a suggested lift min gap ${lr.minGapM} at t ${lr.atT} ≥ 0.5 (${lr.hit})`);
 ok(Math.abs(lk.keys[lk.keys.length-1].t-5)<.01,'suggested lift shown in 5 s');}
// seg5a no-turn boarding: outside -> threshold -> Q is one walk (bend ≤ 15°), clear of basket + open leaf; Q -> seat = sit_down root travel backwards
{const b=S['5a_skycity_balloon_in'].basket,h=(a,c)=>Math.atan2(c[0]-a[0],c[2]-a[2])*180/Math.PI;
 const bend=Math.abs(((h(b.threshold,b.Q)-h(b.outside,b.threshold))+540)%360-180);ok(bend<=15,`seg5a door->Q bend ${bend.toFixed(1)}° ≤ 15 (no turn in the basket)`);
 ok(Math.abs(Math.hypot(b.seat[0]-b.Q[0],b.seat[2]-b.Q[2])-.494)<.01&&b.seat[2]>b.Q[2]&&b.seatYawDeg===180,'seg5a seat = Q + 0.494 m backwards (sit_down), facing 180');
 const dsw=Math.hypot(b.outside[0]-DOOR.hingeBasket[0],b.outside[2]-DOOR.hingeBasket[2])-DOOR.leafRadiusM-.17;ok(dsw>=.05,`seg5a outside clear of the door sweep (${dsw.toFixed(3)})`);
 let hb=0;for(const q of legs([b.outside,b.threshold,b.Q]))hb+=bodyHits(BASK.concat(leafOpen(DOOR.openDeg)),q,.3);ok(hb===0,`seg5a walk in clear of basket + open leaf (${hb})`);
 const tl=S['5a_skycity_balloon_in'].timeline.map(t=>t.clip);ok(!tl.some(c=>/turn_180/.test(c)),'seg5a: no walk_turn_180');
 const s6=S['5a_skycity_balloon_in'].path.filter(p=>p.frame==='skycity'&&p.surface==='walkable:skycity').map(p=>p.at);const n=s6.length;
 const hd=[];for(let i=1;i<n;i++)hd.push(h(s6[i-1],s6[i]));const last=hd[hd.length-1],door=S['5a_skycity_balloon_in'].balloon.yawDeg+h(b.outside,b.threshold);
 ok(Math.abs(((last-door)+540)%360-180)<1,`seg5a approach arrives on the door heading (${last.toFixed(1)} vs ${door.toFixed(1)})`);
 let mx=0;for(let i=1;i<hd.length;i++)mx=Math.max(mx,Math.abs(((hd[i]-hd[i-1])+540)%360-180));ok(mx<=30,`seg5a approach bends ≤ 30° each (${mx.toFixed(1)})`);}
// motion rule (产品总监 2026-10-25): she walks INTO the vehicle and sits down inside; on arrival she stands up, opens the door, walks out.
// No seated frame while moving on the ground: sit_* only as the last beats of a boarding segment (after door_reach / boarding walk) and
// as the first beats of an arrival segment (before stand_up); every walk beat lies between them.
{const clips=b=>b.clip.split(/[^A-Za-z0-9_]+/).filter(c=>/_/.test(c));
 const BOARD=['1_island_board','3_meadow_balloon_in','5a_skycity_balloon_in'],OUT=['2_meadow_landing','4_skycity_balloon_out','5b_lake_balloon_out'];
 for(const id of BOARD){const tl=S[id].timeline.map(clips),iSit=tl.findIndex(c=>c.some(x=>/^sit_/.test(x)));
  ok(iSit===tl.length-1&&tl[iSit][0]==='sit_down',`${id}: sit_down is the last beat (${tl.map(c=>c[0]).join(' > ')})`);
  ok(tl.slice(0,iSit).every(c=>!c.some(x=>/^(sit_|stand_up)/.test(x))),`${id}: no sit/stand before boarding is complete`);
  if(id!=='1_island_board'){const iD=tl.findIndex(c=>c.includes('door_reach'));ok(iD>=0&&iD<iSit&&tl.slice(iD+1,iSit).some(c=>c.some(x=>/^walk_/.test(x))),`${id}: door_reach then walk in, then sit`);}
  const seat=S[id].path[S[id].path.length-1];ok(seat.frame==='basket'||seat.frame==='boat',`${id}: seated point is vehicle-local (${seat.frame})`);}
 for(const id of OUT){const tl=S[id].timeline.map(clips),iSt=tl.findIndex(c=>c.some(x=>/^stand_up/.test(x)));
  ok(tl[0].includes('sit_hold')&&iSt>0&&tl.slice(0,iSt).every(c=>c.every(x=>/^sit_/.test(x))),`${id}: seated hold, then stand_up first (${tl.map(c=>c[0]).join(' > ')})`);
  ok(tl.slice(iSt+1).every(c=>!c.some(x=>/^sit_/.test(x))),`${id}: no sit after stand_up`);
  const firstWalk=tl.findIndex(c=>c.some(x=>/^walk_/.test(x)&&!/^walk_turn_/.test(x)));ok(firstWalk>iSt,`${id}: walking starts only after stand_up`);
  if(id!=='2_meadow_landing'){const iD=tl.findIndex(c=>c.includes('door_reach'));ok(iD>iSt&&iD<firstWalk,`${id}: stand_up > door_reach > walk out`);}}}
// timings: only existing clips, real durations
const CL=J.clips;for(const [id,s] of Object.entries(S))for(const b of s.timeline){for(const c of b.clip.split(/[^A-Za-z0-9_]+/))if(/_/.test(c))ok(c in CL,`${id} clip ${c} exists in the character glb`);}
const anim=Object.fromEntries((()=>{const g=JSON.parse((()=>{const b=fs.readFileSync(BUN+'region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb');return b.subarray(20,20+b.readUInt32LE(12)).toString();})());return (g.animations||[]).map(a=>[a.name,Math.max(...a.samplers.map(s=>g.accessors[s.input].max[0]))]);})());
for(const [c,d] of Object.entries(CL))ok(c in anim&&Math.abs(anim[c]-d)<.002,`clip ${c} ${d}s matches glb ${anim[c]}`);
console.log(`${fails?'FAIL':'PASS'} transition-spaces: ${checks-fails}/${checks} checks`);process.exit(fails?1:0);
