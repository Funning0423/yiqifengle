const R='/tmp/wtE';const S=require(R+'/tools/journey-integration/journey-scene.cjs'),F=require(R+'/tools/journey-integration/journey-framing-lib.cjs');
const L=S.legs[1],f=S.focus2,P=require('./a2.json'),last=P.at(-1),root=last.root,fs=require('fs');
const ring=[];for(const r of [0,2,4,6])for(let a=0;a<(r?8:1);a++)ring.push([f[0]+r*Math.cos(a*Math.PI/4),f[1]+.1,f[2]+r*Math.sin(a*Math.PI/4)]);
const vis=pos=>ring.filter(q=>!S.blockers(L.objs,pos,q).length).length/ring.length;
let ax=[last.position[0]-f[0],last.position[2]-f[2]];const l=Math.hypot(...ax);ax=ax.map(x=>x/l);const sd=[-ax[1],ax[0]];
const [back,up,side,w]=JSON.parse(process.env.E||'[25,15,-3,0.5]'),CR=+(process.env.CR||3),HOLD=+(process.env.HOLD||.5),fps=15;
const p1=[root[0]+ax[0]*back+sd[0]*side,f[1]+up,root[2]+ax[1]*back+sd[1]*side],ch=[root[0],root[1]+.9,root[2]],t1=f.map((x,i)=>x+(ch[i]-x)*w);
const nrm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)},d0=nrm(last.target.map((x,i)=>x-last.position[i])),d1=nrm(t1.map((x,i)=>x-p1[i]));
const mj=u=>u*u*u*(10-15*u+6*u*u),h1=u=>u-6*u**3+8*u**4-3*u**5,pb=P.at(-2).position,v0=last.position.map((x,i)=>(x-pb[i])*fps);
const E=P.map(p=>({...p,phase:'walk'}));const n=Math.round(CR*fps),nh=Math.round(HOLD*fps);
for(let k=1;k<=n+nh;k++){const u=Math.min(1,k/n),s=mj(u),pos=last.position.map((x,i)=>x+(p1[i]-x)*s+v0[i]*CR*h1(u)),d=nrm(d0.map((x,i)=>x+(d1[i]-x)*s));
 E.push({i:last.i+k,d:last.d,position:pos,target:pos.map((x,i)=>x+d[i]*8),fov:last.fov,root,yaw:last.yaw,phase:k<=n?'crane':'hold'});}
// metrics per frame
const rows=[];let prev=null;for(const [j,p] of E.entries()){const c={position:p.position,target:p.target,fovVerticalDeg:p.fov},b=F.body(c,p.root),pl=F.ndc(c,f);
 const hid=[.9,1.3,1.5,1.6].filter(y=>S.blockers(L.objs,p.position,[p.root[0],p.root[1]+y,p.root[2]]).length).length,[cl,who]=S.clearance(p.position,L.objs,5);
 const dv=F.dir(c),ang=prev?F.angle(prev,dv)*fps:0;prev=dv;
 rows.push({j,t:+(j/fps).toFixed(3),phase:p.phase,y:p.position[1],aboveFloor:p.position[1]-f[1],aboveHer:p.position[1]-p.root[1],h:b.height,inFrame:b.inFrame,hid,cl,who,angRate:ang,px:pl[0],py:pl[1],vis:(j%5===0||j>=150)?vis(p.position):null,pos:p.position});}
for(let j=0;j<rows.length;j++){const a=rows[Math.max(0,j-1)].pos,b=rows[Math.min(rows.length-1,j+1)].pos;rows[j].speed=Math.hypot(...b.map((x,i)=>x-a[i]))/((Math.min(rows.length-1,j+1)-Math.max(0,j-1))/fps);}
for(let j=0;j<rows.length;j++){const a=rows[Math.max(0,j-1)].speed,b=rows[Math.min(rows.length-1,j+1)].speed;rows[j].acc=(b-a)/((Math.min(rows.length-1,j+1)-Math.max(0,j-1))/fps);}
for(let j=0;j<rows.length;j++){const a=rows[Math.max(0,j-1)].acc,b=rows[Math.min(rows.length-1,j+1)].acc;rows[j].jerk=(b-a)/((Math.min(rows.length-1,j+1)-Math.max(0,j-1))/fps);}
fs.writeFileSync('E.json',JSON.stringify(E));fs.writeFileSync('E_metrics.json',JSON.stringify(rows.map(({pos,...r})=>r)));
const fin=rows.at(-1),walk=rows.filter(r=>r.phase=='walk'),cr=rows.filter(r=>r.phase!='walk');
const mx=(a,k)=>Math.max(...a.map(r=>Math.abs(r[k]))),mn=(a,k)=>Math.min(...a.map(r=>r[k]));
console.log(JSON.stringify({frames:E.length,dur:(E.length/fps).toFixed(2),walk:{hMin:mn(walk,'h'),hMax:mx(walk,'h'),hidFrames:walk.filter(r=>r.hid).length,clMin:mn(walk,'cl'),angMax:mx(walk,'angRate'),out:walk.filter(r=>!r.inFrame).length},
 crane:{hMin:mn(cr,'h'),hidFrames:cr.filter(r=>r.hid).length,clMin:mn(cr,'cl'),angMax:mx(cr,'angRate'),vMax:mx(cr,'speed'),aMax:mx(cr,'acc'),jMax:mx(cr,'jerk'),out:cr.filter(r=>!r.inFrame).length},
 final:{h:fin.h,px:fin.px,py:fin.py,fromTop:(1-fin.py)/2*100,fromLeft:(fin.px+1)/2*100,vis:fin.vis,aboveFloor:fin.aboveFloor,aboveHer:fin.aboveHer,cl:fin.cl},sideVec:{right_of_her_heading:(()=>{const hx=Math.sin(last.yaw),hz=Math.cos(last.yaw);const v=[p1[0]-root[0],p1[2]-root[2]];return v[0]*(-hz)+v[1]*hx})()}},null,1));
