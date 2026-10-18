const R=120,foot=[2.6,2.203,11.6],h=844,w=390,fov=49.43;
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
for(const yaw of [0,45,90,225])for(const mode of ['none','sphere','cyl']){const pr=25*Math.PI/180,ay=yaw*Math.PI/180,c=[foot[0],foot[1]+0.86,foot[2]],P=[c[0]+Math.sin(ay)*9*Math.cos(pr),c[1]+9*Math.sin(pr),c[2]+Math.cos(ay)*9*Math.cos(pr)];
 const f=unit(sub(c,P)),r=unit([-f[2],0,f[0]]),u=cross(r,f),t=Math.tan(fov*Math.PI/360);const hd=unit([f[0],0,f[2]]);
 const y=(side)=>{const a=side*12*Math.PI/180,d=[hd[0]*Math.cos(a)-hd[2]*Math.sin(a)*1,0,hd[2]*Math.cos(a)+hd[0]*Math.sin(a)];const g=[P[0]+d[0]*30,foot[1],P[2]+d[2]*30];
  const drop=mode==='none'?0:mode==='cyl'?(g[2]-foot[2])**2/(2*R):((g[0]-foot[0])**2+(g[2]-foot[2])**2)/(2*R);g[1]-=drop;const q=sub(g,P),z=dot(q,f);return {y:(1-dot(q,u)/(z*t))/2*h,x:(dot(q,r)/(z*t*w/h)+1)/2*w,drop};};
 const L=y(-1),Rr=y(1);console.log('yaw',yaw,mode,'ground@30m ±12°: left y',L.y.toFixed(0),'right y',Rr.y.toFixed(0),'tilt',Math.abs(Math.atan2(Rr.y-L.y,Rr.x-L.x)*180/Math.PI).toFixed(1)+'°','drop L/R',L.drop.toFixed(2),Rr.drop.toFixed(2));}
