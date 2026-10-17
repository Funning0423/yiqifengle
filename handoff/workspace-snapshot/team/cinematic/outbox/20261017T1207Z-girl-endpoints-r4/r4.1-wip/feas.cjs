const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const RBL=J.H.load(J.S+'region/RegionBoardLanding.ts'),BLy=J.H.load(J.S+'ui/BoardLayout.ts'),MS=J.H.load(J.S+'region/MeadowSceneData.ts');
const T=require('./td_meadow.json');const SCR=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024],[1024,768]];
function evalAt(p,w,h){const safe=BLy.boardSafeInsets(w,h),ui=RBL.girlStandUi(w,h,safe),cam=MS.meadowScenePose(w/h),b=RBL.girlBoxPt(cam,p,w,h);if(!b)return null;
 if(b.l<0||b.r>w||b.t<0||b.b>h)return {gap:-1,b};let gap=Math.min(b.l,w-b.r,b.t,h-b.b);for(const q of ui){const ox=Math.min(b.r,q.r)-Math.max(b.l,q.l),oy=Math.min(b.b,q.b)-Math.max(b.t,q.t);if(ox>0&&oy>0)return {gap:-1,b};gap=Math.min(gap,Math.hypot(Math.max(q.l-b.r,b.l-q.r,0),Math.max(q.t-b.b,b.t-q.b,0)));}
 const FL={maxAbsX:.7,minY:-.85,maxY:.75},nx=[b.l/w*2-1,b.r/w*2-1],ny=[1-b.b/h*2,1-b.t/h*2];return {gap,b,inFL:nx[0]>=-FL.maxAbsX&&nx[1]<=FL.maxAbsX&&ny[0]>=FL.minY&&ny[1]<=FL.maxY};}
module.exports={evalAt,SCR,T,J,RBL,BLy,MS};
if(require.main===module){const out=[];
for(let i=0;i<T.zs.length;i++)for(let j=0;j<T.xs.length;j++){const y=T.H[i][j];if(y<-900||T.N[i][j]<.85||T.T[i][j]-y>.05)continue;const p=[T.xs[j],y,T.zs[i]];
 const r=SCR.map(([w,h])=>evalAt(p,w,h));const g=r.map(e=>e?e.gap:-1);out.push({p,g,fl:r.map(e=>e&&e.inFL)});}
const por=out.filter(o=>o.g.slice(0,7).every(x=>x>=6));console.log('walkable',out.length,'clear all 7 portrait >=6pt',por.length);
por.sort((a,b)=>Math.min(...b.g.slice(0,7))-Math.min(...a.g.slice(0,7)));for(const o of por.slice(0,15))console.log(o.p.map(v=>v.toFixed(2)).join(','),o.g.map(v=>v.toFixed(0)).join(' '),o.fl.map(v=>v?1:0).join(''));
for(let k=0;k<8;k++)console.log(SCR[k].join('x'),'clear>=6:',out.filter(o=>o.g[k]>=6).length,' clear>=6 & inFL:',out.filter(o=>o.g[k]>=6&&o.fl[k]).length);
require('fs').writeFileSync('feas_meadow.json',JSON.stringify(out));}
