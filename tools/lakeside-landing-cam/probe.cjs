const Jn=require('../journey-integration/journey-scene.cjs');
const {sky,sA,yaw,sOff,rotY,add,skyNodes}=Jn;
console.log('yaw',yaw,'sOff',sOff, 'skyframe objs',sky.length, Object.keys(skyNodes||{}).slice(0,5));
const nodes={S0:[5.4,-0.11,43.8],S4:[0.2,3.308,-5.8],S5:[0.2,0.078,-17],S6:[0.2,0.032,-27.8]};
for(const k in nodes)console.log(k,add(rotY(yaw,nodes[k]),sOff).map(v=>v.toFixed(2)).join(','));
try{console.log('spawn anchor',sA('anchor_spawn_girl').map(v=>v.toFixed(2)).join(','));}catch(e){console.log('no anchor',e.message)}
const st=add(rotY(yaw,nodes.S6),sOff);
const toL=p=>[2-(p[0]-st[0]),0.58+(p[1]-st[1]),63.2-(p[2]-st[2])];
// bbox of sky geometry in lake-local, and deck coverage profile along x≈1.6
let a=[1e9,1e9,1e9],b=[-1e9,-1e9,-1e9];const cells={};
for(const o of sky){const t=o.tris;for(let k=0;k<t.length;k+=3){const q=toL([t[k],t[k+1],t[k+2]]);for(let c=0;c<3;c++){a[c]=Math.min(a[c],q[c]);b[c]=Math.max(b[c],q[c]);}
 if(Math.abs(q[0]-1.6)<6&&q[1]>-3&&q[1]<3){const z=Math.round(q[2]);cells[z]=(cells[z]||0)+1;}}}
console.log('sky lake-local bbox',a.map(v=>v.toFixed(1)),b.map(v=>v.toFixed(1)));
console.log('deck verts near x1.6 by z:',Object.keys(cells).map(Number).sort((x,y)=>x-y).filter(z=>z>20&&z<110).map(z=>z+':'+cells[z]).join(' '));
const names={};for(const o of sky){names[o.name]=(names[o.name]||0)+1;}console.log(Object.keys(names).slice(0,60).join(' '));
(async()=>{const {decode}=require('../camera-frame-test/glb_geometry.cjs');
const g=await decode(Jn.ROOT+'/creator-build-project/assets/bundles/region_skycity/env_skycity.glb');
let a=[1e9,1e9,1e9],b=[-1e9,-1e9,-1e9];const prof={},nm={};
for(const name in g.meshes){for(const tri of g.meshes[name])for(const v of tri){const q=toL(add(rotY(yaw,v),sOff));
 for(let c=0;c<3;c++){a[c]=Math.min(a[c],q[c]);b[c]=Math.max(b[c],q[c]);}
 if(q[1]>-3&&q[1]<4&&Math.abs(q[0]-1.6)<8){const z=Math.round(q[2]/2)*2;prof[z]=(prof[z]||0)+1;nm[name]=Math.min(nm[name]??1e9,q[2]);}}}
console.log('full sky bbox L',a.map(v=>v.toFixed(1)),b.map(v=>v.toFixed(1)));
console.log('deck-height verts |x-1.6|<8 by z',Object.keys(prof).map(Number).sort((x,y)=>x-y).map(z=>z+':'+prof[z]).join(' '));
console.log('min z per mesh near path',Object.entries(nm).sort((x,y)=>x[1]-y[1]).slice(0,12).map(e=>e[0]+'@'+e[1].toFixed(1)).join(' '));})();
