const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const RB=J.H.load(J.S+'region/RegionBoardLanding.ts'),BL=J.H.load(J.S+'ui/BoardLayout.ts'),V=J.H.load(J.S+'region/SkycityVisitPose.ts'),RC=J.H.load(J.S+'world-r1/RegionCameraData.ts');
const spawn=J.sp('anchor_spawn_girl'),court=J.sp('anchor_starcourt_center');const FL=RC.REGION_CAMERA.frameLimits;
const SCR=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
const T=[];for(const n of J.local.skycity){if(/state_.*before/.test(n.name))continue;for(let i=0;i<n.tris.length;i+=9)T.push(n.tris.slice(i,i+9));}
function topY(x,z){let best=-1e9;for(const t of T){const [ax,ay,az,bx,by,bz,cx,cy,cz]=t;const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;const y=l1*ay+l2*by+l3*cy;if(y>best&&y<3)best=y;}return best;}
const cams=SCR.map(([w,h])=>({w,h,safe:BL.boardSafeInsets(w,h),cam:V.skycityVisitPose(spawn,court,w/h)}));
const res=[];
for(let x=-16;x<=8;x+=0.25)for(let z=30;z<=49;z+=0.25){const y=topY(x,z);if(y<-3||y>2.5)continue;const p=[x,y,z];
 const g=cams.map(({w,h,safe,cam})=>{const b=RB.girlBoxPt(cam,p,w,h);if(!b||b.l<0||b.r>w||b.t<0||b.b>h)return -1;let gap=Math.min(b.l,w-b.r,b.t,h-b.b);
  for(const q of RB.girlStandUi(w,h,safe)){const ox=Math.min(b.r,q.r)-Math.max(b.l,q.l),oy=Math.min(b.b,q.b)-Math.max(b.t,q.t);if(ox>0&&oy>0)return -1;gap=Math.min(gap,Math.hypot(Math.max(q.l-b.r,b.l-q.r,0),Math.max(q.t-b.b,b.t-q.b,0)));}return gap;});
 res.push({p,g});}
for(let k=0;k<SCR.length;k++){const ok=res.filter(r=>r.g[k]>=6).sort((a,b)=>b.g[k]-a.g[k]);console.log(SCR[k].join('x'),ok.length,ok.slice(0,8).map(r=>`(${r.p[0]},${r.p[2]})${r.g[k].toFixed(0)}`).join(' '));}
const all=res.filter(r=>r.g.every(v=>v>=6));console.log('clear on all 7 portrait:',all.length,all.slice(0,10).map(r=>JSON.stringify(r.p.map(v=>+v.toFixed(2)))+r.g.map(v=>v.toFixed(0)).join('/')).join(' '));
const five=res.filter(r=>r.g.filter(v=>v>=6).length>=5).sort((a,b)=>b.g.filter(v=>v>=6).length-a.g.filter(v=>v>=6).length);console.log('>=5:',five.slice(0,12).map(r=>JSON.stringify(r.p.map(v=>+v.toFixed(2)))+' '+r.g.map(v=>v.toFixed(0)).join('/')).join('\n'));
require('fs').writeFileSync(__dirname+'/../qa/sky_grid.json',JSON.stringify({screens:SCR,res}));
