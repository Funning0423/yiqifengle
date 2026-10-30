#!/usr/bin/env node
'use strict';
/* fg-mainpkg-gate (GGbot). Hard gates for the WeChat first package (main package, everything outside game.json subpackages)
 * and for privacy-relevant wx APIs (we collect no personal information).
 *   node tools/build-guard/check-main-package.cjs --out <wechat build output>   real guard-build output (testers)
 *   node tools/build-guard/check-main-package.cjs --config                     build config + last guard evidence + source scan
 * Exit 0 = PASS, 1 = FAIL, 2 = usage. Read-only. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),P=path.join(ROOT,'creator-build-project');
const MAIN_MAX=4000000; // Grok Bot 2026-10-29: "4 MB" = 4,000,000 B
// Privacy-relevant wx APIs. Any use (wx.X, wx['X'], wx["X"]) fails. Add an API here before anyone may use it.
const PRIVACY_APIS=Object.freeze([
 'getUserInfo','getUserProfile','createUserInfoButton','login','checkSession','getPhoneNumber','authorize','openSetting',
 'getLocation','getFuzzyLocation','chooseLocation','startLocationUpdate','startLocationUpdateBackground','onLocationChange',
 'chooseImage','chooseMedia','chooseVideo','chooseMessageFile','previewMedia','saveImageToPhotosAlbum','saveVideoToPhotosAlbum',
 'getRecorderManager','startRecord','getGameRecorder','createCameraContext','createCamera','createVKSession',
 'getClipboardData','chooseAddress','chooseInvoice','chooseInvoiceTitle','getWeRunData','getFriendCloudStorage',
 'getGroupCloudStorage','getUserCloudStorage','setUserCloudStorage','getUserInteractiveStorage','requirePrivacyAuthorize',
 'startBluetoothDevicesDiscovery','getBluetoothDevices','startWifi','getConnectedWifi','startSoterAuthentication',
 'getChannelsLiveInfo','requestFacialVerify']);
const API_RE=new RegExp("\\bwx\\s*(?:\\.\\s*("+PRIVACY_APIS.join('|')+")\\b|\\[\\s*['\"]("+PRIVACY_APIS.join('|')+")['\"]\\s*\\])",'g');
function scanText(text,file){const hits=[];let m;API_RE.lastIndex=0;while((m=API_RE.exec(text))){const line=text.slice(0,m.index).split('\n').length;hits.push({file,line,api:m[1]||m[2]});}return hits;}
function walk(d,out){if(!fs.existsSync(d))return out;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(e.name!=='node_modules')walk(p,out);}else out.push(p);}return out;}
function scanFiles(files){const hits=[];for(const f of files)if(/\.(js|ts|cjs|mjs)$/.test(f)&&fs.statSync(f).size<64*1024*1024)hits.push(...scanText(fs.readFileSync(f,'utf8'),f));return hits;}
function bytes(p){if(!fs.existsSync(p))return 0;const s=fs.statSync(p);return s.isFile()?s.size:walk(p,[]).reduce((a,f)=>a+fs.statSync(f).size,0);}
function measureOut(out){const gj=JSON.parse(fs.readFileSync(path.join(out,'game.json'),'utf8'));const roots=(gj.subpackages||[]).map(s=>String(s.root).replace(/\/+$/,''));
  const sub={};for(const r of roots)sub[r]=bytes(path.join(out,r));const total=bytes(out),main=total-Object.values(sub).reduce((a,b)=>a+b,0);return {main,total,subpackages:sub};}
function checkOut(out){const m=measureOut(out),fails=[];if(m.main>MAIN_MAX)fails.push(`main package ${m.main} B > ${MAIN_MAX} B`);
  const hits=scanFiles(walk(out,[]));for(const h of hits)fails.push(`privacy API wx.${h.api} at ${path.relative(out,h.file)}:${h.line}`);return {mode:'out',out,...m,limit:MAIN_MAX,privacyHits:hits.length,fails};}
function checkConfig(opts={}){const fails=[],repo=opts.repo||ROOT,proj=path.join(repo,'creator-build-project');
  const cfg=JSON.parse(fs.readFileSync(opts.releaseConfig||path.join(repo,'tools/build-guard/wechat-release.json'),'utf8'));
  if(cfg.mainBundleCompressionType!=='subpackage')fails.push(`wechat-release.json mainBundleCompressionType=${cfg.mainBundleCompressionType} (must be subpackage, else the ~2.3 MB Cocos main bundle lands in the first package)`);
  const b=JSON.parse(fs.readFileSync(path.join(proj,'settings/v2/packages/builder.json'),'utf8'));const wx=b.bundleConfig&&b.bundleConfig.custom&&b.bundleConfig.custom.wx_subpackage;
  const ow=wx&&wx.configs&&wx.configs.miniGame&&wx.configs.miniGame.overwriteSettings&&wx.configs.miniGame.overwriteSettings.wechatgame;
  if(!ow||ow.compressionType!=='subpackage'||ow.isRemote!==false)fails.push('builder.json wx_subpackage wechatgame must be {compressionType:subpackage,isRemote:false}');
  const bd=path.join(proj,'assets/bundles'),bundles=[];for(const e of fs.readdirSync(bd,{withFileTypes:true}))if(e.isDirectory()){const meta=path.join(bd,e.name+'.meta');
    const ud=fs.existsSync(meta)?(JSON.parse(fs.readFileSync(meta,'utf8')).userData||{}):{};bundles.push(e.name);if(ud.isBundle!==true||ud.bundleConfigID!=='wx_subpackage')fails.push(`bundle ${e.name} is not a wx_subpackage bundle (would ship in the first package)`);}
  const ev=JSON.parse(fs.readFileSync(opts.evidence||path.join(repo,'tools/build-guard/main-package-evidence.json'),'utf8'));
  if(!(Number.isSafeInteger(ev.rootBytes)&&ev.rootBytes>0))fails.push('evidence rootBytes missing');else if(ev.rootBytes>MAIN_MAX)fails.push(`last guard build ROOT ${ev.rootBytes} B > ${MAIN_MAX} B`);
  let evidenceVerified=null;if(ev.source&&fs.existsSync(ev.source)){const t=fs.readFileSync(ev.source);evidenceVerified=crypto.createHash('sha256').update(t).digest('hex')===ev.sourceSha256;
    const m=/^\s*ROOT (\d+)/m.exec(t.toString('utf8'));if(!evidenceVerified)fails.push('evidence log sha256 mismatch');if(!m||Number(m[1])!==ev.rootBytes)fails.push('evidence rootBytes does not match the guard log ROOT line');}
  const src=[...walk(path.join(proj,'assets'),[]),...walk(path.join(proj,'build-templates'),[])];const hits=scanFiles(src);
  for(const h of hits)fails.push(`privacy API wx.${h.api} at ${path.relative(repo,h.file)}:${h.line}`);
  return {mode:'config',limit:MAIN_MAX,rootBytes:ev.rootBytes,headroom:MAIN_MAX-ev.rootBytes,evidence:ev.source,evidenceVerified,bundles:bundles.length,scannedFiles:src.length,privacyHits:hits.length,fails};}
module.exports={MAIN_MAX,PRIVACY_APIS,scanText,measureOut,checkOut,checkConfig};
if(require.main===module){const a=process.argv.slice(2);let r;
  if(a[0]==='--out'&&a[1])r=checkOut(path.resolve(a[1]));else if(a[0]==='--config')r=checkConfig();else{console.error('usage: check-main-package.cjs --out <wechat build output> | --config');process.exit(2);}
  console.log(JSON.stringify(r,null,1));console.log(r.fails.length?'FAIL main-package/privacy gate:\n  '+r.fails.join('\n  '):`PASS main package ${r.main??r.rootBytes} B <= ${MAIN_MAX} B, privacy APIs 0`);process.exit(r.fails.length?1:0);}
