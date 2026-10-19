const A=require('./audit.cjs');
(async()=>{const from=A.startCamera(0),kn={...A.KN,...(process.argv[2]?JSON.parse(process.argv[2]):{})};const S=A.newShot(A.landingFor([390,844]),kn);const o=[];
for(let t=9.4;t<=S.timing.durationS+.01;t+=.5){const p=S.camera(t,from).position,v=S.vehicle(t),d=[p[0]-v[0],p[1]-v[1]-1.3,p[2]-v[2]],h=Math.hypot(d[0],d[2]);o.push(t.toFixed(1)+':'+(Math.atan2(d[0],d[2])*180/Math.PI).toFixed(0)+'/'+(Math.atan2(d[1],h)*180/Math.PI).toFixed(0));}console.log(o.join(' '));})();
