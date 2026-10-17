const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');const {f7}=require('./scan2d.cjs');
const out=require('./feas_meadow.json');const ex=J.exit02to08;const M={};
for(const o of out){const [x,,z]=o.p;if((x*2)%1||(z*2)%1)continue;const e=J.Lay.meadowExitExtraM(J.meadowSrc.map.toJourney(o.p),ex);const f=f7(o.p).worst;M[x+','+z]=(e>0.432?'o':(f<=0?'.':'F'));}
const xs=[];for(let x=-8;x<=11.5;x+=0.5)xs.push(x);console.log('      '+xs.map(x=>x%2==0?'|':' ').join(''));
for(let z=-4;z<=23.5;z+=0.5)console.log(z.toFixed(1).padStart(5)+' '+xs.map(x=>M[x+','+z]||' ').join(''));
console.log('x from -8 to 11.5 step .5 (| every 2 m); o=O5 fail, F=F7b fail, .=both ok; spawn (0,20), walk_path_02 (2.33,15.91), 04 (2.58,11.69)');
