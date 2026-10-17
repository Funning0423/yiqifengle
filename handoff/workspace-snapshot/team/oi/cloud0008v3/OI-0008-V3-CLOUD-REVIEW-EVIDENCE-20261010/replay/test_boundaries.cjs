'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const source=process.env.REVIEW_SOURCE||path.resolve(__dirname,'../source');
const {LogTailer,STRONG_ERROR_PATTERNS}=require(path.join(source,'tools/wechat_first_open_audit.cjs')),rules=require(path.join(source,'tools/first_open_console_rules.cjs'));
const output=process.argv[2]||path.join(__dirname,'boundary-results.json');
(async()=>{const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'0008-v3-boundaries-'));const root=path.join(tmp,'WeappLog');fs.mkdirSync(root);const f=path.join(root,'review.log');const prefix='p'.repeat(4096),tail=' '.repeat(200);fs.writeFileSync(f,prefix+tail+'\n');const t=new LogTailer(root,{pollMs:200,maxBytes:100000});t.start();const error='TypeError: replaced suffix was never read';fs.writeFileSync(f,prefix+error+' '.repeat(tail.length-error.length)+'\n');t.poll();await t.stop(0);assert.equal(t.incomplete.length,0);assert.equal(t.lines.some(x=>x.line.includes(error)),false);
const rows=[{name:'same_inode_size_and_4096_prefix_suffix_rewrite',result:'error_not_captured_no_incomplete',fileBytes:fs.statSync(f).size,lines:t.lines,incomplete:t.incomplete,events:t.events}];
for(const text of ['Error: ordinary failure','[其他错误] 资源加载失败','[console.error] ordinary failure'])rows.push({name:'classifier_coverage',text,standalone:rules.classifyText(text),auditStrongPatternHit:STRONG_ERROR_PATTERNS.some(re=>re.test(text))});
fs.writeFileSync(output,JSON.stringify({scope:'Local deterministic log-fixture test only; actual DevTools logfile rewrite behavior not established.',rows},null,2));console.log(JSON.stringify(rows,null,2));fs.rmSync(tmp,{recursive:true,force:true});})();
