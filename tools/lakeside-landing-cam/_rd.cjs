const A=require('./audit.cjs'),{solveEnd}=require('./_walk.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),c=JSON.parse(process.argv[2]);
for(const [w,h,t] of JSON.parse(process.argv[3])){const land=A.landingFor([w,h]),W1=c.W1||solveEnd(A.KN,c.W0,c.endLocal,A.landingFor([390,844]));const S=A.newShot(land,{...A.KN,...(c.kn||{}),walkLens:c.W0,walkLensEnd:W1,walkBlendInS:c.Tb});
 const pose=S.camera(t,from),bb=A.balAt(G,A.LJ.toWorld(A.KN.launchLocal));globalThis.__EDGE=[];A.southBankDump(G,bb,pose,w/h);console.log(w,t,'cam',A.toLocal(pose.position).map(x=>x.toFixed(2)).join(','),'girl',A.toLocal(S.girl(t)).map(x=>x.toFixed(2)).join(','),JSON.stringify(globalThis.__EDGE));}})();
