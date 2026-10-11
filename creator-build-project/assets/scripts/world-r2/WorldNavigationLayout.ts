/** Restored primary/secondary hierarchy: one journey action on the island.
 * Chapter selection belongs inside the journey journal, not a button grid. */
export const ISLAND_NAV_IDS=['mainline'] as const;
export function worldNavigationLayout(width:number,height:number){
  if(![width,height].every(Number.isFinite)||width<=0||height<=0)throw Error('Invalid navigation frame');
  const portrait=width<height,bottom=portrait?50:33;
  const landscapeRow=!portrait&&width>=568;
  const primaryWidth=landscapeRow?Math.min(250,width-344):Math.min(250,width-64);
  return {portrait,supported:width>=320&&height>=320,
    buttons:{mainline:{x:landscapeRow?-width/2+24+primaryWidth/2:0,y:landscapeRow?-height/2+58:-height/2+bottom+(portrait&&height<680?104:116),width:primaryWidth,height:52}},
    back:{x:0,y:-height/2+bottom+23,width:Math.min(220,width-64),height:46},
    dayNight:{x:0,y:height/2-(portrait?82:32),width:144,height:36}};
}
