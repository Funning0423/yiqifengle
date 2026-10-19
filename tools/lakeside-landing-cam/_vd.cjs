const A=require('./audit.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),kn={...A.KN,...JSON.parse(process.argv[2])},bb=A.balAt(G,A.LJ.toWorld(A.KN.launchLocal));
for(const [si,t] of JSON.parse(process.argv[3])){const scr=A.SCREENS[si],S=A.newShot(A.landingFor(scr),kn),pose=S.camera(t,from),asp=scr[0]/scr[1];
 const f=pose.target.map((v,i)=>v-pose.position[i]),fl=Math.hypot(...f),fw=f.map(v=>v/fl),r0=[fw[2],0,-fw[0]],rl=Math.hypot(...r0),r=r0.map(v=>v/rl),up=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]],th=Math.tan(pose.fovVerticalDeg*Math.PI/360);
 const o=A.toLocal(pose.position),hits=[];for(let j=0;j<58;j++)for(let i=0;i<27;i++){const x=((i+.5)/27*2-1)*th*asp,y=((j+.5)/58*2-1)*th,d=[0,1,2].map(c=>fw[c]+r[c]*x+up[c]*y),l=Math.hypot(...d),u=d.map(v=>v/l);
  const a=FL.cast(G.stat,pose.position,u,800),b=FL.cast(bb,pose.position,u,800);if(!a&&!b&&u[1]<-Math.sin(.6*Math.PI/180)){const k=(0.58-o[1])/u[1];const ul=A.toLocal([pose.position[0]+u[0],pose.position[1]+u[1],pose.position[2]+u[2]]).map((v,c)=>v-o[c]);hits.push([i,j,(o[0]+ul[0]*k).toFixed(1),(o[2]+ul[2]*k).toFixed(1)].join(','));}}
 console.log(scr[0],t,'cam',o.map(v=>v.toFixed(2)).join(','),'girl',A.toLocal(S.girl(t)).map(v=>v.toFixed(2)).join(','),hits.join(' | '));}})();
