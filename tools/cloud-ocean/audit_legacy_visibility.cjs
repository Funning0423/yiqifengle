'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),OLD=path.resolve(ROOT,'../../../asset-research/CommonR2/motion/shared');
const renderer=fs.readFileSync(path.join(OLD,'renderer.js'),'utf8'),game=fs.readFileSync(path.join(OLD,'game.js'),'utf8'),events=fs.readFileSync(path.join(OLD,'ocean-events.js'),'utf8');
const line=renderer.split('\n').find(x=>x.trim().startsWith('oceanLeapPose('));const R=new Function('return class R {'+line+'}')(),r=new R;
const H=require('../cloud-ui/harness.cjs')({baseline:true});const results=[];
function rect(n){const p=n.worldPosition,t=n.getComponent(H.UITransform);return{x:p.x-t.width*n.scale.x/2,y:p.y-t.height*n.scale.y/2,w:t.width*n.scale.x,h:t.height*n.scale.y};}
function sampleVisible(x,y,rx,ry,w,h,exclude){let seen=0,total=0;for(let ix=0;ix<9;ix++)for(let iy=0;iy<5;iy++){const px=x-rx+ix*rx/4,py=y-ry+iy*ry/2;if(px<0||px>w||py<0||py>h)continue;total++;if(!exclude.some(q=>px>=q.x&&px<=q.x+q.w&&py>=q.y&&py<=q.y+q.h))seen++;}return total?seen/total:null;}
for(const [w,h] of [[320,568],[390,844],[402,874],[568,320],[844,390]]){
 const {u,s}=H.setup('mainline-v33',0,w,h);s.journey.regionRewards=[];u.render(s);const d=u.layoutInfo,scale=w/390;
 const nodes=[u.boardFrame,u.back,u.bagBtn,u.titleLabel.node.parent,u.targets.moves,...u.goalNodes.filter(n=>n.active),u.pause,u.retryBtn,u.hintBtn,...u.tools.filter(n=>n.active)];
 const exclude=nodes.map(n=>{const a=rect(n);return{x:a.x+w/2,y:h/2-a.y-a.h,w:a.w,h:a.h}});
 // Existing task-4 rail Graphics are painted in root coordinates, not their 1×1 transform.
 if(d.safe.portrait){const tw=Math.min(w-24,Math.max(104,u.toolCatalog().length*62+26));exclude.push({x:w/2-tw/2,y:h/2-d.toolY+3-45,w:tw,h:98});exclude.push({x:w/2-109,y:h/2-d.utilityY-25,w:218,h:58});}
 else exclude.push({x:w-d.safe.right-114,y:d.safe.top+45,w:120,h:236});
 const boardBottom=h/2-d.boardCenter.y+d.board/2,waterTop=boardBottom+18*scale,waterH=Math.max(0,h-waterTop),legacyRect={x:0,y:waterTop/scale,w:390,h:waterH/scale};
 const fish=[0,1,2].map(i=>({row:i,samples:0,visibleSamples:0,mostlyVisibleSamples:0,meanFraction:0,maxFraction:0,yMin:Infinity,yMax:-Infinity}));let gullMostlyVisible=0,gullSamples=0;
 for(let time=0;time<34000;time+=100){for(let i=0;i<3;i++){const phase=(time*.018+i*151)%505,dir=i%2?-1:1,x=(dir>0?-55+phase:445-phase)*scale,y=waterTop+waterH*(.23+i*.27)+Math.sin(time*.0015+i)*4*scale;if(x<0||x>w)continue;const f=sampleVisible(x,y,22*scale,11*scale,w,h,exclude),row=fish[i];if(f===null)continue;row.samples++;row.meanFraction+=f;row.visibleSamples+=Number(f>.05);row.mostlyVisibleSamples+=Number(f>=.75);row.maxFraction=Math.max(row.maxFraction,f);row.yMin=Math.min(row.yMin,y);row.yMax=Math.max(row.yMax,y);}
  const p=time%3500/3500,x=(-38+p*466)*scale,logicalH=h/scale,goalY=(d.safe.top+78)/scale,y=(logicalH<640?14:Math.min(116,goalY-39))*scale;if(x<0||x>w)continue;const visible=sampleVisible(x,y,16*scale,10*scale,w,h,exclude);if(visible!==null){gullSamples++;gullMostlyVisible+=Number(visible>=.75&&y-10*scale>=d.safe.top);}
 }
 for(const f of fish){f.meanFraction=+(f.meanFraction/Math.max(1,f.samples)).toFixed(3);f.mostlyVisibleRatio=+(f.mostlyVisibleSamples/Math.max(1,f.samples)).toFixed(3);f.yMin=+f.yMin.toFixed(1);f.yMax=+f.yMax.toFixed(1);}
 results.push({width:w,height:h,boardBottom:+boardBottom.toFixed(1),waterTop:+waterTop.toFixed(1),waterHeight:+waterH.toFixed(1),fish,gullMostlyVisibleAndSafeRatio:+(gullMostlyVisible/gullSamples).toFixed(3),leapAt12600ms:r.oceanLeapPose(legacyRect,12600),exclusions:exclude});
}
const hashes=Object.fromEntries([['renderer.js',renderer],['game.js',game],['ocean-events.js',events]].map(([k,v])=>[k,crypto.createHash('sha256').update(v).digest('hex')]));
const report={scope:'Read-only old Canvas equations projected behind exact e61 Board rectangles. 9×5 visibility grid is a geometric risk estimate, not native pixels or animation acceptance.',hashes,results,sideEffects:['ocean-events._spillStar decrements engine.bombs','restore increments engine.bombs','_grantPearl changes per-round inventory','consumePearl increments engine.moves','game.update triggers gull and goal audio'],recommendation:'Restore renderer-only ocean/wave/fish and a pure decorative gull sampler; do not install OceanEvents gameplay or audio. Choose visible water/sky lanes from actual layout and exclusions.'};
fs.writeFileSync(path.join(ROOT,'evidence/cloud-ocean/legacy-visibility.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
