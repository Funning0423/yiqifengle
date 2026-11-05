'use strict';
/** r3 (fin r6 3689d151: churn '?:48' — destroyed textures the render graph could not name). Every texture >= 256 KB now carries its
 *  creation site (src=<game frames>) on the create AND the destroy line. Negative: a stack with only engine frames gives src=? (never a
 *  made-up name); the 3689d151 probe has no src= at all. Probe code stays inside QF_PROBE (stripped from release). */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const REL='creator-build-project/assets/scripts/region/CamTraceLog.ts';
function load(src){const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};const cc={Director:{EVENT_AFTER_DRAW:'a'},director:{on(){},off(){}},sys:{},assetManager:{},Game:{},Input:{EventType:{}},game:{on(){}},input:{on(){}},screen:{},view:{},Vec3:class{},MeshRenderer:class{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,console:{log(){}},performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},globalThis:{},require:s=>s==='cc'?cc:s.includes('DebugQuery')?{debugSearch:()=>''}:s.includes('CameraPose')?{cameraWriteHook:{}}:{}});return m.exports;}
const cur=fs.readFileSync(path.join(__dirname,'../..',REL),'utf8'),M=load(cur);
const v8='Error\n    at gpuCaller (CamTraceLog.ts:1:1)\n    at dev.createTexture (CamTraceLog.ts:2:2)\n    at e.createTexture (http://x/cocos-js/cc.js:1:2)\n    at e.reset (http://x/cocos-js/cc.js:3:4)\n    at WarmButtonSkin.render (http://x/assets/main/index.js:10:1)\n    at WarmButtonSkin.ensure (http://x/assets/main/index.js:11:1)\n    at Object.makeButton (http://x/assets/main/index.js:12:1)\n    at BoardPanels.show (http://x/assets/main/index.js:13:1)';
assert.equal(M.gpuCaller(v8),'WarmButtonSkin.render<WarmButtonSkin.ensure<makeButton');
assert.equal(M.gpuCaller('Error\n    at e.createTexture (http://x/cocos-js/cc.js:1:2)\n    at t._tick (http://x/cocos-js/cc.js:9:9)'),'?','engine-only stack → ? (negative: no invented name)');
assert.equal(M.gpuCaller('Error\n  render@http://x/assets/main/index.js:1:1\n  createTexture@http://x/cocos-js/cc.js:1:1'),'render','JSC/WebKit stack format');
// device wrap: create + destroy lines carry src=
const lines=[];M.gpuProbe.out=s=>lines.push(s);M.gpuProbe.nameOf=()=>'';
const dev={createTexture(i){return {info:i,destroy(){}};},createShader(){return{};}};M.gpuWrapDevice(dev);
(function WarmButtonSkin_render(){const t=dev.createTexture({width:1000,height:104,format:55});t.destroy();})();
const c=lines.find(l=>/TEX op=create 1000x104/.test(l)),d=lines.find(l=>/TEX op=destroy 1000x104/.test(l));
assert.match(c,/ src=WarmButtonSkin_render/,c);assert.match(d,/ name=\? src=WarmButtonSkin_render/,d);
// sub-256KB creates do not take a TEX detail line or a stack walk; the per-second line carries the family
lines.length=0;dev.createTexture({width:16,height:16,format:35}).destroy();
assert.equal(lines.some(l=>/TEX op=/.test(l)),false,'16x16 is not a TEX detail line');
const base={width:64,height:32};dev.createTexture({texture:base,format:35,type:1});
M.gpuFrame(dev,null,0);M.gpuFrame(dev,null,1000);
const small=lines.find(l=>/^\[QF_GPU\] s=/.test(l));
assert.match(small,/smallN=2 /);
assert.match(small,/f35:u0:g0:s0:t-1:v0:e0=1@16x16/);
assert.match(small,/f35:u0:g0:s0:t1:v1:e0=1@64x32/);
// negative: 3689d151 probe lines have no src=
{const O=load(cp.execFileSync('git',['show','3689d151:'+REL],{cwd:path.join(__dirname,'../..'),encoding:'utf8'}));const L=[];O.gpuProbe.out=s=>L.push(s);O.gpuProbe.nameOf=()=>'';
 const d2={createTexture(i){return {info:i,destroy(){}};}};O.gpuWrapDevice(d2);d2.createTexture({width:1000,height:104,format:55}).destroy();
 assert.ok(L.length===2&&L.every(l=>!/ src=/.test(l)),'old probe cannot name: '+L.join(' | '));assert.equal(O.gpuCaller,undefined);}
// stripped from release
{const S=require('../build-guard/strip-probes.cjs');const out=S.stripText(cur,'CamTraceLog.ts').out;for(const k of ['gpuCaller','srcOf','GPU_PROBE_SRC',' src='])assert.ok(!out.includes(k),'stripped: '+k);}
console.log('PASS gpu-probe-src (V8 + JSC stacks, engine-only = ?, create+destroy src=, small histogram, old probe has none, stripped)');
