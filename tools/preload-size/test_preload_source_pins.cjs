'use strict';
// Self-test for preload-source-pins: would it have caught the Mac dedf8853 drift on the box? (in memory, no files written)
const assert=require('assert'),fs=require('fs'),path=require('path'),P=require('./preload-source-pins.cjs');
// 1) committed pins pass on this tree
const pins=JSON.parse(fs.readFileSync(path.join(__dirname,'preload-source-pins.json'),'utf8'));
assert.deepEqual(P.check(pins,null),[],'committed pins fail on this tree');console.log('ok   committed pins = this tree');
// 2) the situation dedf8853 shipped in: table taken from the f8 era sources (8ad132a2's table, meadow before 3b518fe4 E+D / f0fc7978 encode),
//    pinned to those sources (d3b8e5e4 = 8ad132a2's base), checked against dedf8853 -> must FAIL SOURCE_CHANGED region_meadow
const OLD='8ad132a2',ERA='d3b8e5e4',table=P.tableAt(OLD),sources={};for(const k of Object.keys(table))sources[k]=P.fingerprint(k,ERA);
const bad=P.check({measuredRev:ERA,table,sources},'dedf8853');
assert.ok(bad.some(b=>/^SOURCE_CHANGED region_meadow /.test(b)),'meadow E+D/encode change not caught: '+JSON.stringify(bad));
assert.ok(!bad.some(b=>/TABLE_CHANGED/.test(b)),'dedf8853 still had the old table: no TABLE_CHANGED expected');
console.log('ok   dedf8853 with the f8 table: '+bad.filter(b=>/SOURCE_CHANGED/.test(b)).map(b=>b.split(' ')[1]).join(', ')+' SOURCE_CHANGED (would have failed the box suite)');
// 3) table regenerated without refreshing the pins -> TABLE_CHANGED
const t2={...pins.table,region_meadow:pins.table.region_meadow+1};assert.ok(P.check({...pins,table:t2},null).some(b=>/^TABLE_CHANGED region_meadow/.test(b)));
console.log('ok   table/pin mismatch FAILs');
console.log('preload-source-pins-selftest: PASS');
