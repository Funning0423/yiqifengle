// 2D A* on 0.05 m grid: from A to B avoiding veg discs (h>0.3, r+0.15+M), routeAvoid circles (+M), trunk<1+M, unwalkable
const fs=require('fs');const L=require('./lib.cjs');const RW=require('../board-ui/harness.cjs').createHarness().load('region/RegionWalkable.ts');const RN=require('../region-nodes/bake-region-nodes.cjs');
const M=+(process.env.M||0.05);const [ax,az,bx,bz]=process.argv.slice(2).map(Number);
const F=JSON.parse(fs.readFileSync('/workspace/tmp-exp/dec/props_clusters.json')).filter(f=>f.r<2&&(f.hT??(f.top-f.yMin))>0.3&&!/rock|bench|fence/.test(f.label));
const T=[];for(const v of Object.values({...(()=>{const o={};const tc=L.trunkClear([[0,0,0],[0,0,0.001]]);return o;})()}))T.push(v);
const TR=require('./lib.cjs');const trunkPts=[];// reuse trunkClear via tiny segment
const bad=(x,z)=>{if(RW.walkFloorY('island',x,z)===null)return true;for(const f of F)if(Math.hypot(x-f.x,z-f.z)<f.r+.15+M)return true;for(const [cx,cz,cr] of RN.REGIONS.island.routeAvoid)if(Math.hypot(x-cx,z-cz)<cr+M)return true;
 const tc=L.trunkClear([[x,0,z],[x,0,z+1e-4]]);for(const v of Object.values(tc))if(v<1+M)return true;return false;};
const c=.05,x0=Math.min(ax,bx)-2,z0=Math.min(az,bz)-2,W=Math.ceil((Math.abs(ax-bx)+4)/c),H=Math.ceil((Math.abs(az-bz)+4)/c);
const blocked=new Uint8Array(W*H);for(let j=0;j<H;j++)for(let i=0;i<W;i++)blocked[j*W+i]=bad(x0+i*c,z0+j*c)?1:0;
const id=(x,z)=>Math.round((z-z0)/c)*W+Math.round((x-x0)/c);const s=id(ax,az),g=id(bx,bz);blocked[s]=0;blocked[g]=0;
const dist=new Float64Array(W*H).fill(1e9),par=new Int32Array(W*H).fill(-1);dist[s]=0;const open=[[0,s]];
while(open.length){open.sort((a,b)=>a[0]-b[0]);const [,u]=open.shift();if(u===g)break;const ui=u%W,uj=(u/W)|0;
 for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const vi=ui+di,vj=uj+dj;if(vi<0||vj<0||vi>=W||vj>=H)continue;const v=vj*W+vi;if(blocked[v])continue;const nd=dist[u]+Math.hypot(di,dj)*c;if(nd<dist[v]){dist[v]=nd;par[v]=u;open.push([nd+Math.hypot((vi*c+x0)-bx,(vj*c+z0)-bz),v]);}}}
if(dist[g]>1e8){console.log('NO PATH');process.exit(1);}const P=[];for(let u=g;u>=0;u=par[u])P.push([+(x0+(u%W)*c).toFixed(2),+(z0+((u/W)|0)*c).toFixed(2)]);P.reverse();
// simplify by line-of-sight
const los=(a,b)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/0.02);for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n;if(bad(x,z)&&!(Math.hypot(x-ax,z-az)<.01||Math.hypot(x-bx,z-bz)<.01))return false;}return true;};
const S=[P[0]];let i=0;while(i<P.length-1){let j=P.length-1;while(j>i+1&&!los(P[i],P[j]))j--;S.push(P[j]);i=j;}
console.log('len',dist[g].toFixed(3),'simplified',JSON.stringify(S));
