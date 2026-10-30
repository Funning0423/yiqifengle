'use strict';
// known-timings.json v2 stays readable in check_ui_motion.py terms: every item has file/name/ms/cls with the scanner's classes,
// and each named constant still exists with that value (so a stale entry cannot silently hide a retime).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const K=require('./known-timings.json'),S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
assert.ok(Array.isArray(K.register));for(const i of K.items){assert.ok(['small','enter','exit','screen','skip'].includes(i.cls),i.name);assert.ok(i.file&&i.name&&Number.isFinite(i.ms)&&i.reason,i.name);
 const src=fs.readFileSync(path.join(S,i.file),'utf8');if(!i.name.startsWith('tween('))assert.ok(new RegExp('\\b'+i.name+'\\s*[:=]\\s*'+String(i.ms/(/ms$/i.test(i.name)?1:1000)).replace(/^0\./,'0?\\.')+'0*\\b').test(src),i.file+' '+i.name+'='+i.ms);}
console.log('PASS ui-timing known-timings v2 ('+K.items.length+' items, check_ui_motion.py-compatible)');
