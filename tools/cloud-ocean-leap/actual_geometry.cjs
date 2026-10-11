'use strict';
const U=require('../cloud-ui/harness.cjs')();
module.exports=function geometry(H,canvas,w,h,{goals=1}={}){
 const {u,s}=U.setup('mainline-v33',0,w,h);s.journey.regionRewards=[];s.active.goalOrder=Array.from({length:goals},(_,i)=>'type'+i);s.active.goals=Object.fromEntries(s.active.goalOrder.map(x=>[x,15]));s.uiStatus='当前关卡目标';u.render(s);
 for(const child of [...canvas.children])if(child.name!=='OriginalMainlineBackground'){child.destroy();canvas.children=canvas.children.filter(x=>x!==child)}
 function copy(n,parent){const out=new H.Node(n.name);parent.addChild(out);out.active=n.active;out.setPosition(n.position);out.setScale(n.scale);const t=n.getComponent(U.UITransform);if(t)out.addComponent(H.UITransform).setContentSize(t.width,t.height);const label=n.getComponent(U.Label);if(label)out.addComponent(H.Label).string=label.string;const skip=['CenteredNativeGrid','NativeStageSelection','NativeResult','Backpack','RetryConfirm'].includes(n.name);if(!skip)for(const child of n.children)copy(child,out);return out}
 for(const child of u.root.children)copy(child,canvas);
 const d=u.layoutInfo,p=u.grid.position,t=u.grid.getComponent(U.UITransform);const result={width:w,height:h,portrait:d.safe.portrait,boardTop:h/2-p.y-t.height/2,gridHeight:t.height,gridWidth:t.width,gridPosition:{...p}};u.node.destroy();return result;
};
