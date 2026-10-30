'use strict';
// fg-mainpkg-gate self-test: config/evidence gate passes on the real tree; synthetic oversize / misconfigured / privacy cases fail.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const G=path.join(__dirname,'check-main-package.cjs'),gate=require(G),ROOT=path.resolve(__dirname,'../..');
assert.equal(gate.MAIN_MAX,4000000);
for(const api of ['getUserInfo','getUserProfile','getLocation','chooseImage','getPhoneNumber','getRecorderManager','createCameraContext','getClipboardData'])assert(gate.PRIVACY_APIS.includes(api),api);
// 1) real tree: build config + last guard evidence + source scan
const real=gate.checkConfig();assert.deepEqual(real.fails,[],'real tree passes: '+real.fails.join('; '));assert(real.rootBytes<=4000000);assert.equal(real.privacyHits,0);
// 2) privacy scanner
assert.equal(gate.scanText("wx.getUserInfo({})",'a').length,1);assert.equal(gate.scanText("wx [ 'getLocation' ]()",'a')[0].api,'getLocation');
assert.equal(gate.scanText("wx.getClipboardData()",'a').length,1);assert.equal(gate.scanText("wx.setClipboardData({}); wx.vibrateShort(); wx.getUpdateManager(); foo.getUserInfo()",'a').length,0);
// 3) synthetic build outputs
const T=fs.mkdtempSync(path.join(os.tmpdir(),'qf-maingate-'));const mk=(name,rootBytes,subBytes,extra)=>{const d=path.join(T,name);fs.mkdirSync(path.join(d,'subpackages/main'),{recursive:true});
  fs.writeFileSync(path.join(d,'game.json'),JSON.stringify({subpackages:[{name:'main',root:'subpackages/main/'}]}));fs.writeFileSync(path.join(d,'game.bin'),Buffer.alloc(rootBytes-fs.statSync(path.join(d,'game.json')).size));
  fs.writeFileSync(path.join(d,'subpackages/main/m.bin'),Buffer.alloc(subBytes));if(extra)fs.writeFileSync(path.join(d,'subpackages/main/x.js'),extra);return d;};
const run=a=>cp.spawnSync(process.execPath,[G,...a],{encoding:'utf8'});
const ok=mk('ok',4000000,9000000);assert.equal(gate.checkOut(ok).main,4000000);assert.equal(run(['--out',ok]).status,0,'exactly 4,000,000 B passes');
const big=mk('big',4000001,1);const rb=run(['--out',big]);assert.equal(rb.status,1,'4,000,001 B fails');assert.match(rb.stdout,/main package 4000001 B > 4000000 B/);
const priv=mk('priv',1000,10,"function f(){wx.getUserProfile({desc:'x'})}");const rp=run(['--out',priv]);assert.equal(rp.status,1);assert.match(rp.stdout,/privacy API wx\.getUserProfile at subpackages\/main\/x\.js:1/);
// 4) synthetic repo: oversize evidence, main bundle not subpackaged, a bundle outside wx_subpackage, privacy call in a script
const R=path.join(T,'repo'),proj=path.join(R,'creator-build-project');for(const d of ['tools/build-guard','creator-build-project/settings/v2/packages','creator-build-project/assets/bundles/a','creator-build-project/assets/scripts','creator-build-project/build-templates'])fs.mkdirSync(path.join(R,d),{recursive:true});
fs.copyFileSync(path.join(ROOT,'creator-build-project/settings/v2/packages/builder.json'),path.join(proj,'settings/v2/packages/builder.json'));
fs.writeFileSync(path.join(proj,'assets/bundles/a.meta'),JSON.stringify({userData:{isBundle:true,bundleConfigID:'wx_subpackage'}}));
fs.writeFileSync(path.join(R,'tools/build-guard/wechat-release.json'),JSON.stringify({mainBundleCompressionType:'subpackage'}));
fs.writeFileSync(path.join(R,'tools/build-guard/main-package-evidence.json'),JSON.stringify({rootBytes:1871139}));
assert.deepEqual(gate.checkConfig({repo:R}).fails,[],'clean synthetic repo passes');
fs.writeFileSync(path.join(R,'tools/build-guard/main-package-evidence.json'),JSON.stringify({rootBytes:4000001}));assert.match(gate.checkConfig({repo:R}).fails.join(),/ROOT 4000001 B > 4000000 B/,'oversize evidence fails');
fs.writeFileSync(path.join(R,'tools/build-guard/main-package-evidence.json'),JSON.stringify({rootBytes:1871139}));
fs.writeFileSync(path.join(R,'tools/build-guard/wechat-release.json'),JSON.stringify({mainBundleCompressionType:'merge_dep'}));assert.match(gate.checkConfig({repo:R}).fails.join(),/mainBundleCompressionType=merge_dep/);
fs.writeFileSync(path.join(R,'tools/build-guard/wechat-release.json'),JSON.stringify({mainBundleCompressionType:'subpackage'}));
fs.mkdirSync(path.join(proj,'assets/bundles/b'));assert.match(gate.checkConfig({repo:R}).fails.join(),/bundle b is not a wx_subpackage bundle/);fs.rmdirSync(path.join(proj,'assets/bundles/b'));
fs.writeFileSync(path.join(proj,'assets/scripts/S.ts'),"const p=wx.getLocation({type:'gcj02'});");assert.match(gate.checkConfig({repo:R}).fails.join(),/privacy API wx\.getLocation at creator-build-project\/assets\/scripts\/S\.ts:1/);
fs.rmSync(T,{recursive:true,force:true});
console.log(`PASS main-package gate: real ROOT ${real.rootBytes} B, headroom ${real.headroom} B, evidence verified=${real.evidenceVerified}, ${real.scannedFiles} source files, 0 privacy APIs`);
