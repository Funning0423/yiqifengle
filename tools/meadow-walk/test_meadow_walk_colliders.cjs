'use strict';
// Grok Bot 2026-10-26: no walk node or handoff point inside a collider (body radius 0.3 m). Real env_meadow.glb solids
// (same solid set as tools/region-nodes/bake-region-nodes.cjs minus floor-only meshes), body = vertical capsule axis sampled
// 0.3…1.4 m above the point. KNOWN FAIL until 场景设计部 nudges M6 off windmill_static (data; do not move it here).
const assert=require('node:assert/strict'),path=require('node:path');
const {load}=require('../journey-integration/occlusion/lib-glb.cjs');
const H=require('../board-ui/harness.cjs').createHarness();
const PW=H.load('region/BalloonB1Start.ts'),RN=H.load('region/RegionNodes.ts'),TL=H.load('region/TransportLeg.ts');
const R=0.3,SOLID=/meadow_fence|meadow_trees|windmill_static|wind_bell_frame/;
const glb=load(path.join(__dirname,'../../creator-build-project/assets/bundles/region_meadow/env_meadow.glb')).filter(n=>n.tris&&SOLID.test(n.name));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function segD(p,a,b){const ab=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),ab)/(dot(ab,ab)||1)));const q=[a[0]+ab[0]*t,a[1]+ab[1]*t,a[2]+ab[2]*t];return Math.hypot(...sub(p,q));}
function triD(p,a,b,c){const n=cross(sub(b,a),sub(c,a)),nn=Math.hypot(...n);if(nn>1e-12){const u=n.map(x=>x/nn),d=dot(sub(p,a),u),q=sub(p,u.map(x=>x*d));
 const s1=dot(cross(sub(b,a),sub(q,a)),n),s2=dot(cross(sub(c,b),sub(q,b)),n),s3=dot(cross(sub(a,c),sub(q,c)),n);if(s1>=0&&s2>=0&&s3>=0)return Math.abs(d);}
 return Math.min(segD(p,a,b),segD(p,b,c),segD(p,c,a));}
function clearance(at){let best={d:Infinity,mesh:null};for(const n of glb){const T=n.tris;for(let k=0;k<T.length;k+=9){const a=[T[k],T[k+1],T[k+2]],b=[T[k+3],T[k+4],T[k+5]],c=[T[k+6],T[k+7],T[k+8]];
 for(const h of [.3,.6,.9,1.2,1.4]){const d=triD([at[0],at[1]+h,at[2]],a,b,c);if(d<best.d)best={d,mesh:n.name};}}}return best;}
const pts=[...RN.REGION_NODES.meadow.nodes.map(n=>[n.key,n.at]),['handoff gate',PW.B1_HANDOFF],['A6 end (sail M1)',TL.SAIL_M1_LOCAL]];
const res={},bad=[];for(const [k,at] of pts){const c=clearance(at);res[k]={d:+c.d.toFixed(3),mesh:c.mesh};if(c.d<R)bad.push(k+' '+c.d.toFixed(3)+' m from '+c.mesh);}
console.log(JSON.stringify({bodyR:R,clearance:res}));
assert.deepEqual(bad,[],'inside a collider (body r 0.3): '+bad.join('; '));
console.log('PASS meadow nodes + handoff points clear of colliders (r 0.3 m)');
