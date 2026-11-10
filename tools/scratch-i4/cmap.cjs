const L=require('./lib.cjs');const RW=L.J.H.load(L.J.S+'region/RegionWalkable.ts');
const PVa=Object.entries(L.PV).filter(([n])=>!/rear_window/.test(n)).flatMap(([n,v])=>v.map(p=>[p[0],p[1],p[2],n]));
let s='';for(let z=+process.argv[2];z>=+process.argv[3]-1e-9;z-=0.2){let r=z.toFixed(1).padStart(5)+' ';for(let x=+process.argv[4];x<=+process.argv[5]+1e-9;x+=0.2){const y=RW.walkFloorY('island',x,z);if(y===null){r+='~';continue;}
 let clip=false;for(const p of PVa){const d=Math.hypot(p[0]-x,p[2]-z),dy=p[1]-y;if(dy<-0.1||dy>1.9)continue;if(d<0.22||(d<0.42&&dy>=0.6)){clip=true;break;}}
 const o=L.occl(L.P0,[x,y,z]);r+=clip?'X':o.lean>25?'#':o.lean>0?'+':'.';}s+=r+'\n';}
console.log('x '+process.argv[4]+'..'+process.argv[5]+' step .2   ~ unwalkable  X palm clip  # lean>25%  + lean>0\n'+s);
