'use strict';
/* 场景特效bot r5 S2: footprint of the skycity deck in the skycity -> lakeside journey layout, in lake-local coordinates
 * (LakesideCameraLayout.lakesideJourney(S6), the same placement journey-scene.cjs / 运镜bot's lakeside-landing-cam audit use),
 * for lakeside_far_ring.py: the ring grass is pressed below the deck there (it came up through the floor at S6 and at the
 * moored balloon). Output: lakeside_skycity_mask.json {cell, deck:[[x,z,top]...] (2 m cells whose skycity floor top is at
 * walking level), route:[[x,z]...] (S0..S6 + S6 -> balloon launch, 0.5 m steps)}.
 *   QF_TYPESCRIPT_MODULE=... DRACO3D=... node tools/scene-fx/lakeside_skycity_mask.cjs [--check]
 * --check: report the highest ring grass (LK_terrain_i / LK_far_hills_i) against the deck top and along the route. */
const path=require('path'),fs=require('fs'),JI=path.join(__dirname,'../journey-integration/');
const Jn=require(JI+'journey-scene.cjs'),LKS=require(JI+'lakeside/lakeside-scene.cjs'),{decode}=require(path.join(__dirname,'../camera-frame-test/glb_geometry.cjs'));
const {H,S,rotY,add,sub,yaw,sOff}=Jn,LC=H.load(S+'region/LakesideCameraLayout.ts');
const NODES=[[5.4,-0.11,43.8],[0.2,3.308,-5.8],[0.2,0.078,-17],[0.2,0.032,-27.8]];  // S0, S4, S5, S6 (skycity-local)
const LAUNCH=[-8,.58,53.5];  // LakesideBalloon launchLocal (moored basket, lake-local)
const S6=add(rotY(yaw,NODES[3]),sOff),LJ=LC.lakesideJourney(S6),toL=p=>rotY(-LJ.yawDeg,sub(p,LJ.root));
const C=2;
function grid(o){const G=new Map(),t=o.tris;for(let k=0;k<t.length;k+=9){const xs=[t[k],t[k+3],t[k+6]],zs=[t[k+2],t[k+5],t[k+8]];
 for(let i=Math.floor(Math.min(...xs)/C);i<=Math.floor(Math.max(...xs)/C);i++)for(let j=Math.floor(Math.min(...zs)/C);j<=Math.floor(Math.max(...zs)/C);j++){const key=i+','+j;if(!G.has(key))G.set(key,[]);G.get(key).push(k);}}o.G=G;return o;}
function top(objs,x,z,ymax){let best=null;for(const o of objs){const L=o.G.get(Math.floor(x/C)+','+Math.floor(z/C));if(!L)continue;const t=o.tris;
 for(const k of L){const ax=t[k],az=t[k+2],bx=t[k+3],bz=t[k+5],cx=t[k+6],cz=t[k+8],den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-12)continue;
  const a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,c=1-a-b;if(a<-1e-9||b<-1e-9||c<-1e-9)continue;
  const y=a*t[k+1]+b*t[k+4]+c*t[k+7];if(y<=ymax&&(best===null||y>best))best=y;}}return best;}
(async()=>{const g=await decode(Jn.ROOT+'/creator-build-project/assets/bundles/region_skycity/env_skycity.glb');if(!g)throw Error('set DRACO3D');
 const T=[];for(const n in g.meshes){if(!/static_palette|floor_seal|ruins|rock_strata/.test(n))continue;for(const tri of g.meshes[n])for(const v of tri)T.push(...toL(add(rotY(yaw,v),sOff)));}
 const sky=grid({tris:Float64Array.from(T)});
 const route=[];const nodes=NODES.map(p=>toL(add(rotY(yaw,p),sOff))).concat([LAUNCH]);
 for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],L=Math.hypot(b[0]-a[0],b[2]-a[2]),n=Math.max(1,Math.ceil(L/.5));for(let k=0;k<=n;k++)route.push([+(a[0]+(b[0]-a[0])*k/n).toFixed(2),+(a[2]+(b[2]-a[2])*k/n).toFixed(2)]);}
 if(process.argv.includes('--check')){
  const ring=LKS.instances().filter(o=>/^LK_(terrain|far_hills)_i$/.test(o.name)).map(o=>grid({tris:o.tris}));let worst=null,over=0,n=0;
  for(let x=-60;x<=110;x+=.5)for(let z=10;z<=140;z+=.5){const s=top([sky],x,z,5);if(s===null||s<.2)continue;n++;const r=top(ring,x,z,80);if(r===null)continue;if(r>s-.05)over++;if(!worst||r-s>worst.d)worst={x,z,deck:+s.toFixed(3),ring:+r.toFixed(3),d:+(r-s).toFixed(3)};}
  let rw=null;for(const [x,z] of route){const r=top(ring,x,z,80);if(r!==null&&(!rw||r>rw.ring))rw={x,z,ring:+r.toFixed(3)};}
  const at=p=>({deck:top([sky],p[0],p[2],5),ring:top(ring,p[0],p[2],80)});
  console.log(JSON.stringify({deckSamples:n,ringAboveDeckMinus5cm:over,worstVsDeck:worst,routeMaxRingY:rw,S6:at(nodes[3]),launch:at(LAUNCH)}));return;}
 const deck=[];for(let i=-40;i<=60;i++)for(let j=0;j<=75;j++){let hi=null;for(const [u,v] of [[.5,.5],[1.5,.5],[.5,1.5],[1.5,1.5],[1,1]]){const s=top([sky],i*C+u,j*C+v,5);if(s!==null&&s>=.2)hi=hi===null?s:Math.min(hi,s);}
  if(hi!==null)deck.push([i*C+1,j*C+1,+hi.toFixed(3)]);}
 const out={about:'skycity deck footprint in the skycity->lakeside journey layout (lake-local); see lakeside_skycity_mask.cjs',cell:C,deck,route};
 fs.writeFileSync(path.join(__dirname,'lakeside_skycity_mask.json'),JSON.stringify(out));console.log('deck cells',deck.length,'route pts',route.length,'deck top min',Math.min(...deck.map(d=>d[2])));})();
