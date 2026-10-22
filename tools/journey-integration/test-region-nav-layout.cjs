'use strict';
// Journey-region buttons (Mac re-check 2607de6): 继续旅程 + 主页 share one low row, equal widths, inside a bottom safe area,
// (b16: the old 04→05 / 08→09 walking-leg feet checks were removed with the rainbow bridge). Island slots (signpost/mainline,
// back, day-night) are byte-for-byte the values of 2607de6, so no sign moves or resizes.
const assert=require('node:assert/strict'),cp=require('child_process'),fs=require('fs'),path=require('path'),Module=require('module');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript'),ROOT=path.resolve(__dirname,'../..');
const load=src=>{const m=new Module('x');m._compile(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText,'x.js');return m.exports;};
const F='creator-build-project/assets/scripts/world-r2/WorldNavigationLayout.ts';
const NEW=load(fs.readFileSync(path.join(ROOT,F),'utf8')),OLD=load(cp.execSync('git show 2607de6:'+F,{cwd:ROOT}).toString());
const sizes=[[390,844],[375,812],[375,667],[414,896],[360,780],[320,568],[430,932]];let n=0;const rows=[];
for(const [w,h] of sizes){const a=NEW.worldNavigationLayout(w,h),b=OLD.worldNavigationLayout(w,h);
 assert.deepEqual({buttons:a.buttons,back:a.back,dayNight:a.dayNight},{buttons:b.buttons,back:b.back,dayNight:b.dayNight},'island slots unchanged '+w+'x'+h);n++;
 const {mainline:m,home:o}=a.region;assert.equal(m.width,o.width,'equal widths');assert.equal(m.height,o.height);assert(m.height>=44,'tap target');
 const top=h/2-(m.y+m.height/2),bottomGap=h/2+(m.y-m.height/2);assert(bottomGap>=(h>=780?34:16),'bottom safe area '+bottomGap);
 assert(m.x+m.width/2<o.x-o.width/2,'no overlap');assert(m.x-m.width/2>=16&&true||-w/2+16<=m.x-m.width/2,'side margin');assert(-w/2+16<=m.x-m.width/2&&o.x+o.width/2<=w/2-16);
 if(w===390||w===375&&h===812)rows.push({size:w+'x'+h,mainline:{x:w/2+m.x-m.width/2,y:top,w:m.width,h:m.height},home:{x:w/2+o.x-o.width/2,y:top,w:o.width,h:o.height}});}
console.log(JSON.stringify({status:'PASS',checks:n,rows}));
