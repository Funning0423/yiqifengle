// free space for the balloon (basket r≈1.0 m, envelope r 2.9 m between +3.05…+10.4) along the departure, lake-local x/z grid
const A=require('./audit-geo.cjs');
(async()=>{const G=await A.geometry(),X=(process.env.XS||'2').split(',').map(Number);
 for(const x of X){console.log('x =',x,' rows: basket altitude (m above deck) 0..22; cols z 64→30 step 2; # = balloon fits, . = blocked');
  let hdr='alt ';for(let z=64;z>=30;z-=2)hdr+=String(z).padStart(3);console.log(hdr);
  for(let alt=22;alt>=0;alt-=2){let s=String(alt).padStart(3)+' ';for(let z=64;z>=30;z-=2){const b=A.W([x,.58+alt,z]);let ok=true;
    for(const dy of [.3,.9])if(A.nearest(G.stat,[b[0],b[1]+dy,b[2]],1.2).d<1.0){ok=false;break;}
    if(ok)for(const dy of [4.5,6.7,8.9])if(A.nearest(G.stat,[b[0],b[1]+dy,b[2]],3.4).d<3.1){ok=false;break;}
    s+=ok?'  #':'  .';}console.log(s);}}})();
