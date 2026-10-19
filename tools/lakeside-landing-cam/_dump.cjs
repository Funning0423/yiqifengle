const A=require('/workspace/yiqifengle/work/运镜bot-lakeland/tools/lakeside-landing-cam/audit.cjs');
const FL=require('/workspace/yiqifengle/work/运镜bot-lakeland/tools/journey-integration/journey-framing-lib.cjs');
(async()=>{const G=await A.geometry(),kn={...A.KN,...JSON.parse(process.argv[2])},bb=A.balAt(G,A.LJ.toWorld(kn.launchLocal)),from=A.startCamera(0);
const S=A.newShot(A.landingFor([390,844]),kn);
for(const t of JSON.parse(process.argv[3])){const pose=S.camera(t,from);
 // monkey: re-run grid and print edge rays
 const fw=[pose.target[0]-pose.position[0],pose.target[1]-pose.position[1],pose.target[2]-pose.position[2]];
 console.log('t',t,'cam local',A.toLocal(pose.position).map(x=>x.toFixed(2)).join(','),'tgt',A.toLocal(pose.target).map(x=>x.toFixed(2)).join(','),'girl',A.toLocal(S.girl(t)).map(x=>x.toFixed(2)).join(','),JSON.stringify(A.southBank(G,bb,pose,390/844,14,30)));}
})();
