const ROOT=process.cwd();const {createHarness}=require(ROOT+'/tools/board-ui/harness.cjs');const H=createHarness(),SP=H.load('region/SkyLakePreWalk.ts'),S=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),RN=H.load('region/RegionNodes.ts');const RL=require(ROOT+'/tools/journey-integration/route/route-legs.cjs');
const M=TS.TRANSITION_STAGING.skyMooring5a;const D=[];for(const x of[-1,0,1])for(const y of[-1,0,1])for(const z of[-1,0,1])if(x||y||z){const L=Math.hypot(x,y,z);D.push([x/L,y/L,z/L]);}
(async()=>{const geo=await RL.geometry(),sky=(a,b)=>RL.hit(geo.skyJ,a,b);
for(const K of['S0','S3']){const P=SP.skyLakePreWalk(S.skyLocalToWorld(M,RN.REGION_NODES.skycity.nodes.find(n=>n.key===K).at),M).path;
 let A=[0];for(let i=1;i<P.length;i++)A.push(A[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]));
 const out=[];for(let s=0;s<A[A.length-1];s+=1){let i=0;while(i<P.length-2&&A[i+1]<s)i++;const u=(s-A[i])/(A[i+1]-A[i]);const p=P[i].map((v,c)=>v+(P[i+1][c]-v)*u);
  const row=[s];for(const h of[1.6,2.3,3.0,4.0,5.0]){const q=[p[0],p[1]+h,p[2]];row.push(D.some(d=>sky(q,q.map((v,j)=>v+d[j]*1.15)))?'X':'.');}out.push(row.join(''));}
 console.log(K,P.length,out.join(' '));}})();
