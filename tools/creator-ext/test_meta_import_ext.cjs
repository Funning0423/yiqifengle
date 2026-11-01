#!/usr/bin/env node
'use strict';
// qf-meta-import: list == exact meta-allowlist allowAdd entries; the pure verifier rejects missing / wrong importer / no uuid;
// main.js only requests asset-db query-ready/refresh-asset and never writes a .meta.
const assert=require('assert'),fs=require('fs'),path=require('path');
const {R4_METAS,dbUrl,verify}=require('./qf-meta-import/list.js');
const AL=JSON.parse(fs.readFileSync(path.join(__dirname,'../build-guard/meta-allowlist.json'),'utf8')).files;
for(const [p,imp] of R4_METAS){const e=AL['creator-build-project/'+p];assert.ok(e&&e.allowAdd,'no allowAdd for '+p);assert.equal(e.allowAdd.importer,imp,p);}
assert.equal(R4_METAS.length,9);assert.equal(dbUrl('assets/a/b.png.meta'),'db://assets/a/b.png');
const good={};for(const [p,imp] of R4_METAS)good[p]={importer:imp,uuid:'u'};
assert.deepEqual(verify(good),[]);
const p0=R4_METAS[0][0];assert.ok(verify({...good,[p0]:null})[0].startsWith('MISSING'));
assert.ok(verify({...good,[p0]:{importer:'image',uuid:'u'}})[0].startsWith('IMPORTER'));
assert.ok(verify({...good,[p0]:{importer:'typescript'}})[0].startsWith('NO_UUID'));
const main=fs.readFileSync(path.join(__dirname,'qf-meta-import/main.js'),'utf8');
assert.ok(!/writeFileSync\([^)]*\.meta|save-asset-meta/.test(main),'extension must not write metas');
for(const m of main.matchAll(/req\('([\w-]+)'/g))assert.ok(['query-ready','refresh-asset'].includes(m[1]),'unexpected asset-db call '+m[1]);
console.log('meta-import-ext: PASS');
