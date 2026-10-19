const A=require('./audit.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
(async()=>{const G=await A.geometry(),v=[0,0,0],bb=A.balAt(G,v);
for(const [x,z] of [[-.6,-.6],[-.59,-.57],[.6,.6],[0,-.6],[-.6,0]]){const hs=[];for(let y=0;y<=3.5;y+=.05){const o=[x-1,y,z],h=FL.cast(bb,o,[1,0,0],2);if(h&&Math.abs(h.t-1)<.12)hs.push(y.toFixed(2));}console.log(x,z,hs.join(' '));}})();
