const A=require('./audit.cjs'),{solveEnd}=require('./_walk.cjs');
const c=JSON.parse(process.argv[2]),from=A.startCamera(0),land=A.landingFor([390,844]);const W1=c.W1||solveEnd(A.KN,c.W0,c.endLocal,land);
const S=A.newShot(land,{...A.KN,walkLens:c.W0,walkLensEnd:W1,walkBlendInS:c.Tb}),dt=1/60;const P=t=>S.camera(t,from).position,G=t=>S.girl(t);
const o=[];for(let t=dt;t<S.cut-dt;t+=.1){const a=[0,1,2].map(i=>(P(t+dt)[i]-2*P(t)[i]+P(t-dt)[i])/dt/dt),g=[0,1,2].map(i=>(G(t+dt)[i]-2*G(t)[i]+G(t-dt)[i])/dt/dt);o.push(t.toFixed(1)+':'+Math.hypot(...a).toFixed(2)+'/'+Math.hypot(...g).toFixed(2));}console.log(o.join(' '));
