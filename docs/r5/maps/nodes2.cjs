const T=require('./topmap.cjs'),{render}=require('./render.cjs'),fs=require('fs');
const NODES={
 island:[['I1','门前小径尽头 path end — mainline-01',[-2.1,0,5.3]],['I2','潮池 tide pools — mainline-02',[2.5,0,8]],['I3','东滩 east beach (crab) — mainline-03',[8,0,6]],['I4','灯塔脚 lighthouse foot — mainline-04',[4.5,0,-5]],['I5','西岬 west cape (palm) — 挑战/探索',[-4.5,0,-1]],['I6','南码头 south dock — 帆船出发',null]],
 meadow:[['M0','河岸登陆 river landing — 帆船到达',[0,1.2,20]],['M1','小路 path — mainline-05',[2.6,2.1,11.7]],['M2','坡腰 hillside — mainline-06',[-1.3,3.1,1.1]],['M3','弯道 bend — mainline-07',[-2.9,3.9,-8.3]],['M4','高坡 upper slope — mainline-08',[3,5.8,-16.4]],['M5','风铃 wind bells — r05-meadow 挑战',[6.6,6.5,-21.3]],['M6','风车门前 windmill — 热气球出发',[0.2,6.49,-24.8]]],
 sky:[['S0','前沿草坪 lawn edge — 热气球降落',[5.4,-0.1,43.7]],['S1','星庭 star court — mainline-09',[0,-0.1,30]],['S2','西花园 west garden — mainline-10',[-6,0,19]],['S3','东台地 east terrace — mainline-11',[6,0,8]],['S4','台阶顶 stair plinth — mainline-12',[0,3.3,-5.8]],['S5','巨树下 great-tree base — r05-sky 挑战',[0,0.1,-17]],['S6','星环观景 star-ring view — 终点/自由探索',[0,0,-28]]],
};
const out={};
for(const [id,sc] of [['island',4],['meadow',3],['sky',2]]){const base=T.build(id),list=NODES[id];
 if(id==='island'){let best=null;for(const [k] of base.seen){const ci=(k/8)|0,y=base.layers[ci][k%8],p=[base.x0+(ci%base.W+.5)*base.c,y,base.z0+(((ci/base.W)|0)+.5)*base.c];if(Math.abs(p[0]+1)<2.5&&(!best||p[2]>best[2]))best=p;}list[5][2]=best;}
 const snap=(M,p,tol)=>{let r=T.pathTo(M,p,tol);if(r)return r;let best=null;for(const [kk] of M.seen){const ci=(kk/8)|0,y=M.layers[ci][kk%8],q=[M.x0+(ci%M.W+.5)*M.c,y,M.z0+(((ci/M.W)|0)+.5)*M.c],d=Math.hypot(q[0]-p[0],q[2]-p[2]);if(d<3&&(!best||d<best.d))best={d,q};}return best?T.pathTo(M,best.q,.3):null;};
 const snapped=list.map(([k,name,p])=>{const r=snap(base,p,id==='sky'&&k==='S4'?.6:3);if(!r)throw Error(k+' unreachable');return {k,name,at:r.path.at(-1)};});
 const legs=[],paths=[];for(let i=1;i<snapped.length;i++){const M=T.build(id,snapped[i-1].at),r=T.pathTo(M,snapped[i].at,.6);if(!r)throw Error(id+' leg '+i);legs.push({from:snapped[i-1].k,to:snapped[i].k,walkM:+r.len.toFixed(1),walkS:+(r.len/1.2).toFixed(1),climbM:+(snapped[i].at[1]-snapped[i-1].at[1]).toFixed(2)});paths.push({path:r.path,col:[255,255,255]});}
 const marks=snapped.map((n,i)=>({p:n.at,col:i===0||i===snapped.length-1?[255,200,40]:[255,80,80],r:sc*3+3,label:n.k}));
 const img=render(base,'/workspace/gh/scratch/maps/map_'+id+'.png',sc,marks,paths,id);
 out[id]={nodes:snapped.map(n=>({k:n.k,name:n.name,at:n.at.map(v=>+v.toFixed(2))})),legs,totalWalkM:+legs.reduce((a,l)=>a+l.walkM,0).toFixed(1),reachableAreaM2:+(base.seen.size*base.c*base.c).toFixed(0),heightRange:[+img.ylo.toFixed(1),+img.yhi.toFixed(1)],gridM:base.c,box:T.R[id].box};}
fs.writeFileSync('/workspace/gh/scratch/maps/nodes.json',JSON.stringify(out,null,1));for(const [k,v] of Object.entries(out))console.log(k,JSON.stringify(v.legs),v.totalWalkM,JSON.stringify(v.nodes.map(n=>n.k+':'+n.at.join(','))));
