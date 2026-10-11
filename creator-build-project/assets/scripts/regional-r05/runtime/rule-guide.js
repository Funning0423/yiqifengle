'use strict';
// Read-only presentation data. Coordinates are one-based; tile types retain the
// engine's zero-based identity so a renderer can use the existing piece artwork.
function cell(index) { return {index:index,row:Math.floor(index/7)+1,column:index%7+1}; }
function phaseName(phase) {
  return phase==='ebb'?'退潮':phase==='flood'?'涨潮':phase==='horizontal'?'横向风':phase==='vertical'?'纵向风':phase===0?'明相':'暗相';
}
var RULES={
  tide:{title:'退潮开贝，涨潮取珠',goal:'珍珠',rule:'退潮时消除贝壳所在格，每波打开一层。全部打开后，在涨潮时再次消除该格才能收集珍珠，并触发整列水流。',tool:'潮汐锚消耗1步，固定当前潮位，让接下来两次棋盘行动保持此潮位；不直接收集珍珠。'},
  meadow:{title:'顺着风向传递花粉',goal:'花朵',rule:'按花朵标出的图案顺序送粉。横向风看本格和左右相邻格，纵向风看本格和上下相邻格；范围内消除当前所需图案，每波前进一步。完成后沿当时风向清除整行或整列。',tool:'阳光种子消耗1步，把选中的普通果实变为纵线果实；本次不送粉、不切换风向，之后启动它仍需1步。'},
  sky:{title:'依次点亮明暗星门',goal:'星门',rule:'只处理当前星门。极性符合要求时，在星门本格消除指定图案才充能；未指定图案时任意图案均可。每波只充能一次，完成所需次数后才轮到下一门，并从伙伴格向十字邻格发出回声。',tool:'棱镜迁移消耗1步，交换当前星门与伙伴格的位置；保留充能进度、所需图案及极性，不切换明暗。'}
};
function guide(session) {
  var region=session.stage.region,rule=RULES[region],phase=session.phase();
  var targets=session.pieces.map(function(p,i){
    var current=region!=='sky'||i===session.cursor,required=region==='tide'?p.layers:region==='meadow'?p.pollen.length:p.hits;
    var target={cell:cell(p.index),progress:p.progress,required:required,done:p.done,current:current&&!p.done};
    if(region==='tide'){
      target.phase=p.progress<p.layers?'ebb':'flood';
      target.instruction=p.done?'珍珠已收集':p.progress<p.layers?'退潮时在此格消除，打开剩余'+(p.layers-p.progress)+'层':'贝壳已打开，等待涨潮后在此格消除';
    }else if(region==='meadow'){
      target.requiredType=p.done?null:p.pollen[p.progress];target.pollen=p.pollen.slice();target.axis=phase;
      target.instruction=p.done?'花朵已开放':(phase==='horizontal'?'本格或左右相邻格':'本格或上下相邻格')+'消除所需图案，送入第'+(p.progress+1)+'份花粉';
    }else{
      target.partner=cell(p.partner);target.polarity=p.polarity;target.phaseLabel=phaseName(p.polarity);target.requiredType=p.type===undefined?null:p.type;
      target.instruction=p.done?'星门已连通':!current?'等待前一星门连通':target.phaseLabel+'时在此格消除'+(target.requiredType===null?'任意图案':'指定图案')+'，还需'+(p.hits-p.progress)+'次充能';
    }
    target.phaseMatches=region==='tide'?phase===target.phase:region==='sky'?phase===p.polarity:true;
    return target;
  });
  return {title:rule.title,goalName:rule.goal,rule:rule.rule,phaseLabel:phaseName(phase),
    turnRule:'交换和启动特殊果实各用1步，整次连锁结束后推进环境（潮汐锚固定期间除外）；地区道具也用1步，但不推进环境。',
    heldTurns:session.hold,targets:targets,tool:{kind:session.stage.tool.kind,charges:session.toolCharges,moveCost:1,description:rule.tool}};
}
module.exports=guide;
