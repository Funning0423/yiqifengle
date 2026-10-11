'use strict';
const H=require('../cloud-ui/harness.cjs')({baseline:false});
module.exports=function layout(w,h){const {u,s}=H.setup('mainline-v33',0,w,h);s.journey.regionRewards=[];u.render(s);const d=u.layoutInfo;
 function rect(n){const p=n.worldPosition,t=n.getComponent(H.UITransform);return{name:n.name,x:w/2+p.x-t.width*n.scale.x/2,y:h/2-p.y-t.height*n.scale.y/2,w:t.width*n.scale.x,h:t.height*n.scale.y};}
 const excluded=[u.boardFrame,u.back,u.bagBtn,u.titleLabel.node.parent,u.targets.moves,...u.goalNodes.filter(n=>n.active),u.pause,u.retryBtn,u.hintBtn,...u.tools.filter(n=>n.active)].map(rect);
 if(d.safe.portrait){const tw=Math.min(w-24,Math.max(104,u.toolCatalog().length*62+26));excluded.push({name:'task4-tool-rail',x:w/2-tw/2,y:h/2-d.toolY+3-45,w:tw,h:98},{name:'task4-utility-rail',x:w/2-109,y:h/2-d.utilityY-25,w:218,h:58});}
 else excluded.push({name:'task4-side-rail',x:w-d.safe.right-114,y:d.safe.top+45,w:120,h:236});
 const grid=u.grid.getComponent(H.UITransform),p=u.grid.position;
 return{width:w,height:h,boardTop:h/2-p.y-grid.height/2,gridHeight:grid.height,gridWidth:grid.width,gridPosition:{...p},portrait:d.safe.portrait,exclusions:excluded};
};
