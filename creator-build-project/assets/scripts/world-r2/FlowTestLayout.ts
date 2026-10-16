/** Debug entry geometry in current logical frame units; reserves the whole capsule band. */
export function flowTestLayout(width:number,height:number,host?:{windowWidth?:number;windowHeight?:number;safeArea?:any;capsule?:any}) {
 const finite=(v:any)=>typeof v==='number'&&Number.isFinite(v);
 const portrait=width<height, ww=host?.windowWidth||width, hh=host?.windowHeight||height;
 const sx=width/ww,sy=height/hh; let top=portrait?47:12,bottom=portrait?34:21,left=0,right=0;
 const a=host?.safeArea;
 if(a&&[a.left,a.right,a.top,a.bottom].every(finite)&&a.left>=0&&a.right>=a.left&&a.right<=ww&&a.top>=0&&a.bottom>=a.top&&a.bottom<=hh){top=Math.max(top,a.top*sy);bottom=Math.max(bottom,(hh-a.bottom)*sy);left=a.left*sx;right=(ww-a.right)*sx;}
 const c=host?.capsule;
 if(c&&[c.left,c.right,c.top,c.bottom].every(finite)&&c.left>=0&&c.right>c.left&&c.right<=ww&&c.top>=0&&c.bottom>c.top&&c.bottom<hh*.35)top=Math.max(top,c.bottom*sy);
 else if(portrait)top+=36;
 const safeWidth=Math.max(0,width-left-right-24),safeHeight=Math.max(0,height-top-bottom-24),x=(left-right)/2,start=top+12;
 const twoColumns=safeHeight<314,cellWidth=Math.min(240,twoColumns?(safeWidth-12)/2:safeWidth);
 const rect=(cx:number,cy:number,w:number,h:number)=>({x:cx,y:height/2-cy,width:w,height:h});
 const mark=rect(x,start+20,Math.min(360,safeWidth),40),entry=rect(x,start+40+8+23,Math.min(240,safeWidth),46);
 const rowStart=start+40+8+46+12;
 const stages=[4,8,12].map((n,i)=>({id:'flowTest'+n,...rect(x+(twoColumns?(i%2-.5)*(cellWidth+12):0),rowStart+(twoColumns?Math.floor(i/2):i)*54+23,cellWidth,46)}));
 const exit=rect(x+(twoColumns ? .5*(cellWidth+12):0),rowStart+(twoColumns?1:3)*54+23,cellWidth,46);
 return {supported:cellWidth>=112&&safeHeight>=(twoColumns?206:314),top,mark,entry,stages,exit};
}
/** The progress banner is part of the open debug menu on the home/island shell.
 *  A running checkpoint must not paint it over the meadow or any other play screen. */
export function flowTestBannerVisible(menuOpen:boolean, onShell:boolean, layoutSupported:boolean):boolean {
 return !!(menuOpen && onShell && layoutSupported);
}
export function readFlowTestHost():any {
 const wx=(globalThis as any).wx;let host:any={};try{host=wx?.getWindowInfo?.()||wx?.getSystemInfoSync?.()||{};}catch{}
 try{return {...host,capsule:wx?.getMenuButtonBoundingClientRect?.()};}catch{return host;}
}
