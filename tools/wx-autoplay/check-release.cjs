#!/usr/bin/env node
'use strict';
// node tools/wx-autoplay/check-release.cjs <build-output> [--expect-present]   exit 0 = CLEAN (or PRESENT with flag)
const fs=require('node:fs'),path=require('node:path');
const PAT=/QF_AUTOPLAY|qf-autoplay|__QF_AUTOPLAY/;const out=process.argv[2],expect=process.argv.includes('--expect-present');
if(!out||!fs.existsSync(out)){console.error('usage: check-release.cjs <out>');process.exit(2);}
const hits=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.name.endsWith('.qfap-orig'))continue;
 if(/qf-autoplay/.test(e.name)){hits.push(p);continue;}if(e.isDirectory())walk(p);else if(/\.(js|json|txt|map)$/.test(e.name)&&fs.statSync(p).size<64*1024*1024&&PAT.test(fs.readFileSync(p,'utf8')))hits.push(p);}})(out);
if(expect){if(hits.length){console.log('PRESENT '+hits.length);process.exit(0);}console.log('MISSING');process.exit(1);}
if(hits.length){console.log('NOT CLEAN:\n'+hits.join('\n'));process.exit(1);}console.log('CLEAN: no QF_AUTOPLAY in '+out);
