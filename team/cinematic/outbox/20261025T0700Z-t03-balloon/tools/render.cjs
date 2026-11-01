// usage: node render.cjs <worktree> <out.json>  — low-res ray-cast frames of the skycity→lakeside leg at matching beats
const WT=process.argv[2];process.chdir(WT+'/tools/journey-integration');
const R=require(WT+'/tools/journey-integration/route/route-legs.cjs'),F=R.F;
(async()=>{const G=await R.geometry(),SC=(process.env.SC||"390x844").split("x").map(Number),H=169,W=Math.round(H*SC[0]/SC[1]),leg=R.lakeLeg(G,SC),T=leg.timing,vis=T.rideT-T.cutT;
 const beats=[['open (fade-in done)',T.cutT+.75],['25%',T.cutT+vis*.25],['50%',T.cutT+vis*.5],['75%',T.cutT+vis*.75],['touchdown',T.rideT-.02],['td+1.8 sign in',T.rideT+1.8],['td+4.8 sign out',T.rideT+4.8],['td+5.8',T.rideT+5.8],['board (end)',T.rideT+T.outT+T.durS+.2]];
 const hash=s=>{let h=7;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h;};
 const out={W,H,screen:SC.join('x'),cutT:T.cutT,rideT:T.rideT,visible:vis,frames:[]};
 for(const [name,t] of beats){const c=leg.cam(t),{fw,r,up,th}=F.basis(c),a=W/H,px=[];
  for(let j=0;j<H;j++)for(let k=0;k<W;k++){const x=((k+.5)/W*2-1)*th*a,y=(1-(j+.5)/H*2)*th,d=[0,1,2].map(q=>fw[q]+r[q]*x+up[q]*y),l=Math.hypot(...d),u=d.map(v=>v/l);
   const h=F.cast(G.lake,c.position,u,800),dist=h?h.t:300,e=c.position.map((p,i)=>p+u[i]*Math.min(dist,300));
   const bal=leg.los(t,c.position,e);let col;
   if(bal&&/balloon/.test(bal)){col=[200,120,60];}
   else if(!h){col=u[1]>0?[150+60*(1-u[1]),190+40*(1-u[1]),235]:[70,120,160];}
   else{const nm=h.obj.name||'',g=hash(h.obj.tag+nm),base=/lake_i|foam/.test(nm)?[60,140,200]:[90+(g&63),110+((g>>6)&63),70+((g>>12)&63)],sh=.45+.55*Math.max(0,h.normal[1]*.7+h.normal[0]*.3),fog=Math.min(1,h.t/250);col=base.map((v,i)=>v*sh*(1-fog)+[180,205,230][i]*fog);}
   px.push(col.map(v=>Math.max(0,Math.min(255,Math.round(v)))));}
  // her: project body box / face / chest
  const her=leg.her(t),pts=[];const proj=p=>{const v=p.map((q,i)=>q-c.position[i]),z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2];if(z<.1)return null;const X=(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*a),Y=(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th);return [(X+1)/2*W,(1-Y)/2*H];};
  for(const k of ['face','chest','head','root'])if(her[k]){const q=proj(her[k]);if(q)pts.push([k,...q]);}
  out.frames.push({name,t:+t.toFixed(2),tVis:+(t-T.cutT).toFixed(2),cam:c,px,her:pts});console.error(name,t.toFixed(2));}
 require('fs').writeFileSync(process.argv[3],JSON.stringify(out));})().catch(e=>{console.error(e);process.exit(1);});
