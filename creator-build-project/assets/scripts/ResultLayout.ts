/** Shared world-coordinate result layout; no storage, visibility or reward eligibility changes. */
export function resultLayout(d:any,count=0){
  const external=count>0;
  const portrait=d.safe?.portrait??d.width<d.height*1.1;
  const safe=d.safe||{top:portrait?62:12,bottom:portrait?34:21,left:portrait?0:44,right:portrait?0:44};
  const top=d.height/2-safe.top-(portrait?54:8),bottom=-d.height/2+safe.bottom+8;
  const availableHeight=top-bottom,availableWidth=d.width-safe.left-safe.right-16;
  const actionWidth=portrait?Math.min(240,availableWidth):Math.min(240,Math.max(200,availableWidth-344));
  const nominalViewport=portrait?d.width>=320&&d.height>=568:d.width>=568&&d.height>=320;
  const supportedViewport=nominalViewport&&availableWidth>=(external&&!portrait?432:208)&&availableHeight>=248+(external&&portrait?count*54:0);
  // Unsupported tiny editor windows retain sensible geometry, never zero/negative panels.
  const width=Math.max(208,Math.min(320,external&&!portrait?availableWidth-actionWidth-24:availableWidth));
  const height=Math.max(248,Math.min(360,availableHeight-(external&&portrait?count*54:0)));
  const centreX=(safe.left-safe.right)/2;
  const panelX=external&&!portrait?centreX-(actionWidth+24)/2:centreX;
  const panelY=external&&portrait?top-height/2:(top+bottom)/2;
  const actions=Array.from({length:count},(_,i)=>({x:portrait?centreX:centreX+(width+24)/2,y:portrait?panelY-height/2-31-i*54:(top+bottom)/2+(count-1)*27-i*54,width:actionWidth,height:46}));
  return {width,height,panelX,panelY,actions,safe,portrait,supportedViewport};
}

/** Mirrors the existing navigation eligibility; claimed rewards keep their existing owned-label button. */
export function resultActionCount(s:any){
  if(s.provider==='regional-r05'&&s.state==='result.saved'&&s.result?.completionRecorded)return Number(!!s.nextStageId||Object.keys(s.progress?.records||{}).filter(id=>id.startsWith('r05-'+s.active?.region+'-')).length===4);
  if(s.provider!=='mainline-v33'||s.state!=='result.saved'||!s.result?.completionRecorded)return 0;
  return Number(!!s.nextStageId)+Number(!s.readOnly&&!!s.journey?.chests?.find((x:any)=>x.level===s.active?.level)?.earned)+Number(!s.readOnly&&!!s.journey?.regionRewards?.find((x:any)=>x.region===Math.floor((s.active?.level??0)/4))?.unlocked);
}
