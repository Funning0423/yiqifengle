'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert');
const source=path.resolve(__dirname,'../source');
const OUT=process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(path.join(require('os').tmpdir(),'qf0008-lingering-review-'));
if(fs.existsSync(OUT)&&fs.readdirSync(OUT).length)throw new Error('Refuse nonempty output: '+OUT);
fs.mkdirSync(OUT,{recursive:true});
fs.chmodSync(path.join(__dirname,'review-fake-cli.cjs'),0o755);
const tmp=fs.mkdtempSync(path.join(OUT,'lingering-fixture-')),build=path.join(tmp,'build'),logs=path.join(tmp,'logs'),out=path.join(OUT,'repro-cli-lingers');
fs.mkdirSync(build);fs.copyFileSync(path.join(source,'test/fixtures/oi-r6-first-open-A.project.config.json'),path.join(build,'project.config.json'));fs.writeFileSync(path.join(build,'game.js'),'console.log("stub");');fs.writeFileSync(path.join(build,'game.json'),'{}');
fs.mkdirSync(path.join(logs,'review','WeappLog'),{recursive:true});fs.writeFileSync(path.join(logs,'review','WeappLog','review.log'),'baseline\n');
const env={...process.env,QF_FIRST_OPEN_DRY_RUN:'1',QF_DEVTOOLS_QUIT_FIRST:'0',QF_FIRST_OPEN_SCREENCAPTURE:'0',QF_FIRST_OPEN_IGNORE_ERROR_REGEX:'',QF_WECHAT_CLI:path.join(__dirname,'review-fake-cli.cjs'),QF_MINIPROGRAM_AUTOMATOR_MODULE:path.join(__dirname,'review-fake-automator.cjs'),QF_WECHAT_BUILD_DIR:build,QF_FIRST_OPEN_WORK_ROOT:path.join(tmp,'copies'),QF_FIRST_OPEN_OUT:out,QF_FIRST_OPEN_CONTROL:'A',QF_FIRST_OPEN_VARIANT:'B',QF_FIRST_OPEN_MODE:'auto',QF_FIRST_OPEN_INJECT_SHIM:'1',QF_FIRST_OPEN_KEEP_COPIES:'1',QF_DEVTOOLS_LOG_DIR:logs,QF_AUTO_PORT:'41100',QF_FIRST_OPEN_SETTLE_MS:'0',QF_FIRST_OPEN_LAUNCH_TIMEOUT_MS:'30000',QF_REVIEW_STATE:path.join(tmp,'state'),QF_REVIEW_SCENARIO:'cli-lingers'};
const r=cp.spawnSync(process.execPath,[path.join(source,'tools/wechat_first_open_audit.cjs')],{env,encoding:'utf8',timeout:40000});
fs.writeFileSync(path.join(out,'runner.stdout.txt'),r.stdout||'');fs.writeFileSync(path.join(out,'runner.stderr.txt'),r.stderr||'');
const v=JSON.parse(fs.readFileSync(path.join(out,'verdict.json'),'utf8'));
const mismatches=[];for(const line of fs.readFileSync(path.join(out,'SHA256SUMS.txt'),'utf8').trim().split('\n')){const [expected,p]=line.split('  ');const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,p))).digest('hex');if(expected!==actual)mismatches.push({file:p,expected,actual});}
const result={scope:'Cloud-only fake CLI intentionally remains alive 21 seconds after printing a target error, VM client; no real DevTools.',status:v.status,exit:r.status,targetCli:v.variants[0].steps.cliAuto,targetErrors:v.variants[0].errors,manifestMismatches:mismatches,runLog:fs.readFileSync(path.join(out,'run.log'),'utf8')};
assert.strictEqual(v.status,'PASS');assert.strictEqual(v.variants[0].steps.cliAuto.lines,undefined);assert.ok(mismatches.some(m=>m.file==='run.log'));
fs.writeFileSync(path.join(OUT,'lingering-cli-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

console.log("Evidence directory: "+OUT);
