const A=require('./audit.cjs');(async()=>{const G=await A.geometry(),from=A.startCamera(0),bb=A.balAt(G,A.LJ.toWorld(A.KN.launchLocal));
for(const s of A.SCREENS)console.log(A.SCENE_REF||'worktree',s.join('x'),'t0 void',JSON.stringify(A.voidRays(G,bb,from,s[0]/s[1])),'legacy',JSON.stringify(A.southBank(G,bb,from,s[0]/s[1])));})();
