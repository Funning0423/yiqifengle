const A=require('./audit.cjs');
(async()=>{const G=await A.geometry(),bb=A.balAt(G,A.LJ.toWorld(A.KN.launchLocal));const g=A.LJ.toWorld([-3,.58,55.6]);
 const out=[];for(let x=-6;x<=0.01;x+=.5)for(let z=58;z<=62.01;z+=.5)for(const y of [1.9,2.1,2.4]){const p=A.LJ.toWorld([x,y,z]),pose={position:p,target:[g[0],g[1]+1.2,g[2]],fovVerticalDeg:48};
  const cl=Math.min(A.nearest(G.stat,p).d,A.nearest(bb,p).d);if(cl<1.2)continue;let e=0,gp=999;for(const s of A.SCREENS){const sb=A.southBank(G,bb,pose,s[0]/s[1]);e+=sb.edge+sb.lakeHit;gp=Math.min(gp,A.uiCheck(pose,g,s).gap);}
  const hd=A.los(G,bb,p,[g[0],g[1]+1.55,g[2]]),ch=A.los(G,bb,p,[g[0],g[1]+1.2,g[2]]);if(!e&&gp>=20&&!hd&&!ch)out.push([x,y,z,cl.toFixed(2),gp.toFixed(0)].join(' '));}
 console.log(out.length);console.log(out.join('\n'));})();
