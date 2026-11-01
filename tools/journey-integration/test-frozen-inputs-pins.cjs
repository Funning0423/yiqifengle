'use strict';
// Live gate (Grok Bot, full9c): every file pinned in frozen-production-inputs.json must exist with exactly its pinned sha256.
// Same check as production-integrity's first step, kept as a minimal standalone gate. Optional argv[2] = tree root (proof runs).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const pins=JSON.parse(fs.readFileSync(path.join(root,'tools/journey-integration/frozen-production-inputs.json'),'utf8')).files;
const bad=[];for(const {path:p,sha256:h} of pins){const f=path.join(root,p);
 if(!fs.existsSync(f)){bad.push({path:p,why:'missing'});continue;}
 const a=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');if(a!==h)bad.push({path:p,why:'hash',expected:h,actual:a});}
// Embedded pins (sha literals inside shipped source, e.g. MeadowSceneData derivedGLBSHA256): exactly one `key: "<64 hex>"` in source, equal to sha256(target).
const emb=JSON.parse(fs.readFileSync(path.join(root,'tools/journey-integration/frozen-production-inputs.json'),'utf8')).embeddedPins||[];
for(const e of emb){const sf=path.join(root,e.source),tf=path.join(root,e.target);
 if(!fs.existsSync(sf)||!fs.existsSync(tf)){bad.push({path:e.source+'#'+e.key,why:'missing'});continue;}
 const ms=[...fs.readFileSync(sf,'utf8').matchAll(new RegExp('["\']?'+e.key+'["\']?\\s*[:=]\\s*["\']([0-9a-f]{64})["\']','g'))];
 if(ms.length!==1){bad.push({path:e.source+'#'+e.key,why:'embedded-count-'+ms.length});continue;}
 const a=crypto.createHash('sha256').update(fs.readFileSync(tf)).digest('hex');if(ms[0][1]!==a)bad.push({path:e.source+'#'+e.key+' -> '+e.target,why:'embedded-hash',expected:ms[0][1],actual:a});}
for(const b of bad)console.error('FROZEN-PIN '+b.why+' '+b.path+(b.expected?' expected '+b.expected+' actual '+b.actual:''));
console.log(JSON.stringify({test:'frozen-inputs-pins',pins:pins.length,embeddedPins:emb.length,bad:bad.length,status:bad.length?'FAIL':'PASS'}));
process.exit(bad.length?1:0);
