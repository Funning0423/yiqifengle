'use strict';
// F2: '.cconb' import requests must only target the shipped '.bin' (never the .cconb URL that 404s). Mock downloader only.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('creator-build-project/assets/scripts/SharedBundles.ts','utf8').replace(/^import .* from 'cc';\n/m,'').replace(/^installSharedBundleDeps\(\);\n/m,'').replace(/^installCconbBinOnly\(\);\n/m,'').replace(/export /g,'');
const code=require('./qf-env.cjs').typescript().transpileModule(src,{compilerOptions:{target:99}}).outputText+'\nglobalThis.install=installCconbBinOnly;';
const reqs=[];let failBin=1;
// Same shape as engine 3.8.8 downloadCCONB: try url.replace('.cconb','.bin'), on error try url itself.
const engine=(url,o,cb)=>{const get=(u,k)=>{reqs.push(u);if(u.endsWith('.bin')&&failBin-->0)return k(Error('net'));if(u.endsWith('.cconb'))return k(Error('404'));k(null,'ok');};get(url.replace('.cconb','.bin'),(e,d)=>e?get(url,cb):cb(null,d));};
const am={downloader:{_downloaders:{'.cconb':engine}}};const ctx={assetManager:am,console};ctx.globalThis=ctx;vm.runInNewContext(code,ctx);
assert.equal(ctx.install(am),true);assert.equal(ctx.install(am),false,'idempotent');
let out;am.downloader._downloaders['.cconb']('a/dc/x@b043a.cconb',{},(e,d)=>out=[e,d]);
assert.deepEqual(reqs,['a/dc/x@b043a.bin','a/dc/x@b043a.bin']);assert.equal(out[1],'ok');
assert(!reqs.some(u=>u.endsWith('.cconb')),'no .cconb request');
console.log('PASS cconb requests only target .bin (transient .bin failure retried as .bin)');
