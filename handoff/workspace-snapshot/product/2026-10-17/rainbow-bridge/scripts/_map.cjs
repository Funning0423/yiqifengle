const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const RB=J.H.load(J.S+'region/RegionBoardLanding.ts'),BL=J.H.load(J.S+'ui/BoardLayout.ts'),V=J.H.load(J.S+'region/SkycityVisitPose.ts'),RC=J.H.load(J.S+'world-r1/RegionCameraData.ts');
const spawn=J.sp('anchor_spawn_girl'),court=J.sp('anchor_starcourt_center');const FL=RC.REGION_CAMERA.frameLimits;
const SCR=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
const T=[];for(const n of J.local.skycity){if(/state_.*before/.test(n.name))continue;for(let i=0;i<n.tris.length;i+=9)T.push(n.tris.slice(i,i+9));}
function topY(x,z){let best=-1e9;for(const t of T){const [ax,ay,az,bx,by,bz,cx,cy,cz]=t;const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;const y=l1*ay+l2*by+l3*cy;if(y>best&&y<3)best=y;}return best;}
let s='      ';for(let x=-14;x<=8;x+=1)s+=String(x).padStart(5);s+='\n';for(let z=52;z>=28;z-=1){s+=String(z).padStart(5)+' ';for(let x=-14;x<=8;x+=1){const y=topY(x,z);s+=y<-30?'    .':y.toFixed(1).padStart(5);}s+='\n';}console.log(s);
