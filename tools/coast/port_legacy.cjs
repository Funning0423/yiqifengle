'use strict';
// 海岸支线 9 关: legacy coastal-content.js (ForestCoast) -> regional-r05 stage shape. Usage: node port_legacy.cjs <legacy.js> > draft.json
const L=require(require('path').resolve(process.argv[2])).levels;
const bands=['introduce','combine','combine','timing','peak','peak','relief','combine','finale'];
module.exports=null;
const out=L.map((l,i)=>{const cfg={moves:l.moves,goals:Object.assign({},l.goals),moss:l.moss.slice(),roots:l.roots.map(r=>typeof r==='number'?{index:r,layers:1}:{index:r.index,layers:r.layers}),starters:(l.starters||[]).map(s=>({index:s.index,special:s.special}))};
 if(l.beacons)cfg.beacons=l.beacons.slice();
 return {id:'r06-coast-'+String(i+1).padStart(2,'0'),region:'coast',ordinal:i+1,name:l.name,contentRevision:'port-2026-10-29',intendedBand:bands[i],chapterName:l.chapterName,designIntent:l.description,failHint:l.hint,note:l.note,config:cfg,rules:{},tool:null,seedBank:[],calibration:null,legacy:{moves:l.moves,chapter:l.chapter}};});
process.stdout.write(JSON.stringify(out,null,1)+'\n');
