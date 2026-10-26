'use strict';
// Live gate (Grok Bot, full9c): every file pinned in frozen-production-inputs.json must exist with exactly its pinned sha256.
// Same check as production-integrity's first step, kept as a minimal standalone gate. Optional argv[2] = tree root (proof runs).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const pins=JSON.parse(fs.readFileSync(path.join(root,'tools/journey-integration/frozen-production-inputs.json'),'utf8')).files;
const bad=[];for(const {path:p,sha256:h} of pins){const f=path.join(root,p);
 if(!fs.existsSync(f)){bad.push({path:p,why:'missing'});continue;}
 const a=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');if(a!==h)bad.push({path:p,why:'hash',expected:h,actual:a});}
for(const b of bad)console.error('FROZEN-PIN '+b.why+' '+b.path+(b.expected?' expected '+b.expected+' actual '+b.actual:''));
console.log(JSON.stringify({test:'frozen-inputs-pins',pins:pins.length,bad:bad.length,status:bad.length?'FAIL':'PASS'}));
process.exit(bad.length?1:0);
