'use strict';
const PROFILES=require('./profiles.cjs');
// Research-only. No production imports, state writes, rendering or input handlers.
function range(A,B,lo,hi){const f=a=>A*Math.cos(a)+B*Math.sin(a);let min=Math.min(f(lo),f(hi)),max=Math.max(f(lo),f(hi)),q=Math.atan2(B,A);for(let k=-2;k<=2;k++){const a=q+k*Math.PI;if(a>=lo&&a<=hi){min=Math.min(min,f(a));max=Math.max(max,f(a))}}return[min,max]}
function fishBounds(angle,scale){let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;const co=Math.cos(angle),si=Math.sin(angle);for(const x of [-38,38])for(const y of [-22,22]){const xx=(x*co-y*si)*scale,yy=(x*si+y*co)*scale;left=Math.min(left,xx);right=Math.max(right,xx);top=Math.min(top,yy);bottom=Math.max(bottom,yy)}for(const x of [-10.5,10.5])for(const y of [-17,17]){const xx=range(x,-y,angle-.28,angle+.28),yy=range(y,x,angle-.28,angle+.28);left=Math.min(left,(-29.5*co+xx[0])*scale);right=Math.max(right,(-29.5*co+xx[1])*scale);top=Math.min(top,(-29.5*si+yy[0])*scale);bottom=Math.max(bottom,(-29.5*si+yy[1])*scale)}return{left,right,top,bottom}}
const cache=new Map;
function envelope(scale,span,lift){const key=[scale,span,lift].join('/');if(cache.has(key))return cache.get(key);const drop=lift*18/42,result={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity,scale,span,lift,drop,durationMs:1800};for(let t=0;t<=1800;t++){const p=t/1800,a=Math.atan2(-lift*Math.PI*Math.cos(p*Math.PI),span)*.55,b=fishBounds(a,scale),x=span*p,y=drop-Math.sin(p*Math.PI)*lift;result.left=Math.min(result.left,x+b.left);result.right=Math.max(result.right,x+b.right);result.top=Math.min(result.top,y+b.top);result.bottom=Math.max(result.bottom,y+b.bottom)}
 // Covers every between-sample instant: translation plus worst angular velocity ×
 // maximum corner radius (body <44, tail pivot+corner <49.5), at half a 1ms sample.
 const angularPerMs=.55*lift*Math.PI*Math.PI/span/1800,guard=.5*(Math.max(span,Math.PI*lift)/1800+scale*49.5*angularPerMs)+.001;result.continuousGuard=guard;result.left-=guard;result.right+=guard;result.top-=guard;result.bottom+=guard;result.width=result.right-result.left;result.height=result.bottom-result.top;cache.set(key,result);return result;}
function emptyRectangles(s,margin=2){const d=s.domain,obs=s.occluders.map(r=>({left:Math.max(d.left,r.left-margin),right:Math.min(d.right,r.right+margin),top:Math.max(d.top,r.top-margin),bottom:Math.min(d.bottom,r.bottom+margin)})).filter(r=>r.left<r.right&&r.top<r.bottom),xs=[...new Set([d.left,d.right,...obs.flatMap(r=>[r.left,r.right])])].sort((a,b)=>a-b),ys=[...new Set([d.top,d.bottom,...obs.flatMap(r=>[r.top,r.bottom])])].sort((a,b)=>a-b),rows=ys.length-1,cols=xs.length-1,cells=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>obs.some(r=>xs[x]<r.right&&xs[x+1]>r.left&&ys[y]<r.bottom&&ys[y+1]>r.top))),out=[];
 for(let y=0;y<rows;y++){const blocked=Array(cols).fill(false);for(let end=y;end<rows;end++){for(let x=0;x<cols;x++)blocked[x]||=cells[end][x];let x=0;while(x<cols){while(x<cols&&blocked[x])x++;const left=x;while(x<cols&&!blocked[x])x++;if(x>left){const r={left:xs[left],right:xs[x],top:ys[y],bottom:ys[end+1]};if(r.right-r.left>=22&&r.bottom-r.top>=28)out.push(r)}}}}
 return out.filter((a,i)=>!out.some((b,j)=>i!==j&&(b.left<a.left||b.right>a.right||b.top<a.top||b.bottom>a.bottom)&&a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom));}
/** Actual screen-pixel API. rectangles are visible UI AABBs; a board-tagged rectangle
 * (name=IslandBoardCarving or kind=board) determines footer/side preference only.
 * safe is a physical system safe-area rectangle, not the Board's reserved layout inset. */
function chooseLeapCorridor(input){
 if(!input)return null;const {width,height,horizon}=input;let rectangles=input.rectangles;
 if(!(width>0&&height>0&&[width,height,horizon].every(Number.isFinite))||!Array.isArray(rectangles))return null;
 const validRect=r=>r&&[r.left,r.right,r.top,r.bottom].every(Number.isFinite)&&r.left<r.right&&r.top<r.bottom;rectangles=rectangles.filter(validRect);
 const board=input.boardRect||rectangles.find(r=>r.name==='IslandBoardCarving'||r.kind==='board');if(!validRect(board))return null;
 const safe=validRect(input.safe)?input.safe:{left:0,right:width,top:0,bottom:height},s={width,height,scale:1,boardLeft:board.left,boardRight:board.right,boardBottom:board.bottom,occluders:rectangles,domain:{left:Math.max(0,safe.left)+3,right:Math.min(width,safe.right)-3,top:Math.max(horizon,safe.top)+3,bottom:Math.min(height,safe.bottom)-3}};
 const rectanglesFree=emptyRectangles(s),candidates=[];
 for(const r of rectanglesFree){const lane=r.top>s.boardBottom?'footer':r.right<s.boardLeft?'left-side':r.left>s.boardRight?'right-side':'other-sea';if(lane==='other-sea')continue;
  for(const e of PROFILES){const {fishWidth,span,lift}=e,scale=fishWidth/76;if(e.width>r.right-r.left||e.height>r.bottom-r.top)continue;
   const x=(r.left+r.right-e.width)/2-e.left,surface=(r.top+r.bottom-e.height)/2-e.top,prefer=width<height&&height/width>=2?lane==='footer':lane!=='footer',score=(prefer?10000:0)+fishWidth*10+span*1.4+lift*1.5+(lane==='left-side'?.1:0);
   candidates.push({space:'screen-pixels',lane,fishWidth,scale,span,lift,drop:e.drop,durationMs:1800,startX:x,surfaceY:surface,score,clearRect:r,sweep:{left:x+e.left,right:x+e.right,top:surface+e.top,bottom:surface+e.bottom},continuousGuard:e.continuousGuard});
  }
 }
 candidates.sort((a,b)=>b.score-a.score);return candidates[0]||null;
}
function propose(s){const input={width:s.width,height:s.height,horizon:s.horizon,rectangles:s.occluders,safe:s.physicalSafe};return{candidate:chooseLeapCorridor(input)};}
module.exports={fishBounds,envelope,emptyRectangles,chooseLeapCorridor,propose};
