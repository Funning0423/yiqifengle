'use strict';
// Exact visual-only hunks. Applied only in memory by tests; Board's owner applies serially.
module.exports=function patch(s){
 const edits=[
 ["const ivory=type==='back'||type==='bag'||type==='retry'||type==='hint'||type==='guide';", "const ivory=type==='back'||type==='bag'||type==='retry'||type==='hint'||type==='guide'||type==='pause'||type==='play';"],
 ["import { ManagedToolArt } from './ManagedToolArt';","import { ManagedToolArt } from './ManagedToolArt';\nimport { tactileToolButton, tactileToolGraphics } from './ui/TactileToolButton';"],
 ["surface=warmButton(n,46,46);","surface=tactileToolButton(n);"],
 ["const g=bg?warmButtonGraphics(n,46,46,ivory):", "const g=bg?(['retry','hint','guide','pause','play'].includes(type)?tactileToolGraphics(n):warmButtonGraphics(n,46,46,ivory)):"],
 ["g.roundRect(-24,-24,48,48,14);g.stroke();","g.circle(0,0,25);g.stroke();"],
 ["this.islandPlate(this.tray.getComponent(Graphics)!,Math.min(d.width-24,Math.max(104,catalog.length*62+26)),90,'sea',0,d.toolY-3);","this.tray.getComponent(Graphics)!.clear();"],
 ["this.islandPlate(this.utilityRail.getComponent(Graphics)!,guide?146:70,50,'sea');","this.utilityRail.getComponent(Graphics)!.clear();"],
 ["this.islandPlate(this.utilityRail.getComponent(Graphics)!,218,50,'sea');", "this.utilityRail.getComponent(Graphics)!.clear();"],
 ["this.islandPlate(g,Math.min(348,w-24),90,'sea',0,toolY-3);", "g.clear();"],
 ["this.islandPlate(this.tray.getComponent(Graphics)!,120,228,'sea',w/2-safe.right-54,h/2-safe.top-159);", "this.tray.getComponent(Graphics)!.clear();"]
 ];
 if(s.includes("import { tactileToolButton, tactileToolGraphics } from './ui/TactileToolButton';")){
  for(const [from,to] of edits){if(!s.includes(to))throw Error('Missing integrated material hunk: '+to);if(!from.startsWith('import ')&&s.includes(from))throw Error('Old material hunk still present: '+from);}return s;
 }
 for(const [from,to] of edits){if(!s.includes(from))throw Error('Board visual hunk did not match: '+from);s=s.replace(from,to)}return s};
