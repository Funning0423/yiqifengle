// v3.3 near-water fit (no renderer): splits the Mac v3.2 pixel into the shader's own terms and rescales them.
// Shader (lakeside-water.effect): out = (1-m)*A*(D*sMain + Amb*sAmb) + m*Sky*sSky, m = max(F, floor 0.25) ~ 0.25 on the board water
// (view elevation ~33 deg, Schlick F ~0.04). D = sun colour x N.L/pi, Amb = Sky = r5h3 zenith x ambient illuminance (same colour).
// The absolute exposure is unknown, so each term's SHARE of the measured v3.2 pixel is computed from the term colours and an r5h3
// vertex colour A, then scaled. Robust to which vertex colour sits under the measured spot (3 tried). Layered fog adds ~6% fog colour.
const s2l=c=>c<=0.04045*255?c/255/12.92:Math.pow((c/255+0.055)/1.055,2.4);
const l2s=c=>Math.round(255*(c<=0.0031308?c*12.92:1.055*Math.pow(Math.max(c,0),1/2.4)-0.055));
const P0={main:1,amb:1,sky:1};
function predict(P,vc,{floor=0.25,fog=0.06,mode='layered'}={}){
 const D=[1,0.6,0.32].map(c=>c*3.26*0.398/Math.PI),Z=[0.0116,0.2747,0.4793].map(c=>c*2.44);
 const A=vc.map(s2l).map((c,i)=>c*[0.9,1,1][i]),meas=[25,219,217].map(s2l)/*v3.2 off*/,fogc=[215,170,150].map(s2l);
 return [0,1,2].map(i=>{const td=(1-floor)*A[i]*D[i],ta=(1-floor)*A[i]*Z[i],tsk=floor*Z[i],t=td+ta+tsk;
  const w=meas[i]*(td*P.main+ta*P.amb+tsk*P.sky)/t;return l2s(mode==='layered'?(1-fog)*w+fog*fogc[i]:w);});
}
const VCS=[[41,160,142],[26,124,123],[19,105,112]];
module.exports={predict,VCS,P0};
if(require.main===module){const P={main:0.8,amb:0.35,sky:0.4};for(const vc of VCS)console.log('vc',vc.join('/'),'v3.2 model',predict(P0,vc).join('/'),'-> v3.3',predict(P,vc).join('/'),'(off',predict(P,vc,{mode:'off'}).join('/')+')','target 66/152/146');}
