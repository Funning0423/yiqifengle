'use strict';
// Option A (parked balloon tethered just outside the board frame): candidate shore spots, lake-local grid round the bank.
const A=require('./audit.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
(async()=>{const G=await A.geometry(),LJ=A.LJ,W=p=>LJ.toWorld(p),res=[];
 const lands=A.SCREENS.map(s=>[s,A.landingFor(s)]);const E=lands[0][1],f=[E.target[0]-E.position[0],E.target[2]-E.position[2]],fl=Math.hypot(...f);
 for(let x=-14;x<=18;x+=1)for(let z=20;z<=36;z+=1){const h=FL.cast(G.stat,W([x,6,z]),[0,-1,0],10);if(!h||h.obj.tag!=='lake'||/water|lake_surface/i.test(h.obj.name))continue;const y=6-h.t;if(Math.abs(y-.58)>.6)continue;
  const p=W([x,y,z]);let vis=0;for(const [s,L] of lands){const b=A.balloonOnScreen(L,s[0]/s[1],p);vis=Math.max(vis,b.envelope+(b.basket?1:0));}if(vis>0)continue;
  const bc=(()=>{let m=1e9;for(const dy of[.5,1.5,3,5,6.7,8.5,10])for(let i=0;i<8;i++){const a=i/8*2*Math.PI,r=dy<3?1:2.9;m=Math.min(m,A.nearest(G.stat,[p[0]+Math.cos(a)*r,p[1]+dy,p[2]+Math.sin(a)*r]).d);}return m;})();if(bc<.3)continue;
  const v=[p[0]-E.position[0],p[2]-E.position[2]],ang=Math.acos((v[0]*f[0]+v[1]*f[1])/(Math.hypot(...v)*fl))*180/Math.PI,dBank=Math.hypot(p[0]-A.bank[0],p[2]-A.bank[2]);
  res.push({x,z,y:+y.toFixed(2),ang:+ang.toFixed(1),dBank:+dBank.toFixed(1),clear:+bc.toFixed(2),on:h.obj.name});}
 res.sort((a,b)=>a.ang-b.ang||a.dBank-b.dBank);console.log(res.length);for(const r of res.slice(0,12))console.log(JSON.stringify(r));
})();
