#!/usr/bin/env node
'use strict';
/** Port the r2 async harness I/O (chainJ P0 fix) into a patched harness fork, e.g. the tester's Mac ~/qfap-run/pt/qf-autoplay.js
 *  (repo harness + patch_burst/patch_auto/untilLake ops). Replaces, by exact match, the three old blocks with the repo versions:
 *    w2() appendFileSync → serialized async appendFile/writeFile;  win() getSystemInfoSync per call → read once + onWindowResize;
 *    shot() toTempFilePathSync/copyFileSync/unlinkSync inside EVENT_AFTER_DRAW → async toTempFilePath/copyFile/unlink, one in flight.
 *  Usage: node port-async-io.cjs <fork.js> [out.js]   (default: rewrites <fork.js> in place, keeps <fork.js>.pre-r2)
 *  Exit 2 if an old block is not found exactly once (fork diverged: port by hand). Nothing else in the fork is touched. */
const fs=require('fs'),path=require('path');
const src=process.argv[2],out=process.argv[3]||src;if(!src){console.error('usage: port-async-io.cjs <fork.js> [out.js]');process.exit(2);}
const repo=fs.readFileSync(path.join(__dirname,'qf-autoplay.js'),'utf8');let f=fs.readFileSync(src,'utf8');
const cut=(s,a,b,incl)=>{const i=s.indexOf(a);const j=s.indexOf(b,i);if(i<0||j<0)throw Error('repo marker missing: '+a);return s.slice(i,incl?j+b.length:j);};
const NEW_W2=cut(repo,'/* r2 (chainJ P0): every write','catch(e){put();}}',true);
const NEW_WIN=cut(repo,'/* window size: read ONCE','function win(){return winC;}',true);
const NEW_SHOT=cut(repo,'/* r2 (chainJ P0 freeze',"/* {op:'preTransition'");
const OLD_W2="function w2(file,s,capRef){try{fs.appendFileSync(OUT+'/'+file,s,'utf8');}catch(e){try{fs.writeFileSync(OUT+'/'+file,s,'utf8');}catch(x){}}}";
const OLD_WIN="function win(){try{var i=wx.getSystemInfoSync();return {w:i.windowWidth,h:i.windowHeight,dpr:i.pixelRatio};}catch(e){return {w:DESIGN_W,h:DESIGN_H,dpr:1};}}";
const once=(s,a)=>s.split(a).length-1;
const fail=m=>{console.error('port-async-io: '+m);process.exit(2);};
if(once(f,OLD_W2)!==1)fail('old w2() not found exactly once');if(once(f,OLD_WIN)!==1)fail('old win() not found exactly once');
const i=f.indexOf('var shotN=0;'),j=f.indexOf('\n',f.indexOf('cc.director.once(cc.Director.EVENT_AFTER_DRAW,take)',i));
if(i<0||j<0||once(f,'var shotN=0;')!==1||!/toTempFilePathSync/.test(f.slice(i,j)))fail('old shot() block not found');
f=f.replace(OLD_W2,NEW_W2).replace(OLD_WIN,NEW_WIN);const i2=f.indexOf('var shotN=0;'),j2=f.indexOf('\n',f.indexOf('cc.director.once(cc.Director.EVENT_AFTER_DRAW,take)',i2));f=f.slice(0,i2)+NEW_SHOT.replace(/\n$/,'')+f.slice(j2);
f=f.replace('res.shots=shotN;',"res.shots=shotN;res.shotsRequested=shotStats.requested;res.shotsSkipped=shotStats.skipped;res.shotsFailed=shotStats.failed;res.shotTimeouts=shotStats.timeouts;res.shotMaxMs=shotStats.maxMs;res.screenshotApi='toTempFilePath-async';");
{const A="w2('result.json',JSON.stringify(res,null,1));console.info('[QF_AUTOPLAY] done ok='+res.ok);flush();},",B="w2('result.json',JSON.stringify(res,null,1));flush();});";
 if(once(f,A)===1)f=f.replace(A,"console.info('[QF_AUTOPLAY] done ok='+res.ok);flush();w2('result.json',JSON.stringify(res,null,1));},");else console.warn('port-async-io: result/flush order not changed (fork differs); result.json may land before the last log chunk');
 if(once(f,B)===1)f=f.replace(B,"flush();w2('result.json',JSON.stringify(res,null,1));});");}
if(/\.toTempFilePathSync\(|copyFileSync\(|appendFileSync\(/.test(f.replace(/\/\*[\s\S]*?\*\//g,'')))fail('sync call still present after port (fork has its own sync I/O: port by hand)');
if(out===src)fs.writeFileSync(src+'.pre-r2',fs.readFileSync(src));fs.writeFileSync(out,f);console.log('port-async-io: ok -> '+out);
