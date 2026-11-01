// framing metric: girl box (frac of height), balloon envelope frac/basket, near-floor fraction (first hit skycity within 8 m)
const A=require('./audit.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),scr=[390,844],asp=scr[0]/scr[1];
for(const arg of process.argv.slice(2)){const kn={...A.KN,...JSON.parse(arg)},S=A.newShot(A.landingFor(scr),kn),bb=A.balAt(G,A.LJ.toWorld(A.KN.launchLocal));const o=[];
 for(const t of [1.5,2.6,3.5,5,7]){const p=S.camera(t,from),g=S.girl(t),u=A.uiCheck(p,g,scr),bo=A.balloonOnScreen(p,asp,S.vehicle(t));
  const f=p.target.map((v,i)=>v-p.position[i]),fl=Math.hypot(...f),fw=f.map(v=>v/fl),r0=[fw[2],0,-fw[0]],rl=Math.hypot(...r0),r=r0.map(v=>v/rl),up=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]],th=Math.tan(p.fovVerticalDeg*Math.PI/360);
  let near=0,n=0;for(let j=0;j<30;j++)for(let i=0;i<14;i++){const x=((i+.5)/14*2-1)*th*asp,y=((j+.5)/30*2-1)*th,d=[0,1,2].map(c=>fw[c]+r[c]*x+up[c]*y),l=Math.hypot(...d),uu=d.map(v=>v/l);const h=FL.cast(G.stat,p.position,uu,8);n++;if(h&&h.obj.tag==='sky'&&uu[1]<0)near++;}
  o.push(`${t}: girl ${(u.box[1]/844).toFixed(2)}-${(u.box[3]/844).toFixed(2)} gap ${u.gap} env ${bo.envelope.toFixed(2)} bk ${bo.basket?1:0} nearFloor ${(near/n).toFixed(2)}`);}
 console.log(arg);console.log('  '+o.join('\n  '));}})();
