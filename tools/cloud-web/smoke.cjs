'use strict';
// Browser-adapter entrypoint only. It NEVER starts Chrome, opens a persistent
// profile, attaches to a user's browser, changes flags, or provisions access.
// A supported executor supplies a fresh disposable Playwright-compatible page.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const lib = require('./lib.cjs');

function assertStartup(s) {
  assert.equal(s.loading?.phase,'ready','Current startup did not reach ready');
  assert.equal(s.loading?.gate?.phase,'ready','Startup gate is not ready');
  assert(!s.loading?.error,'Startup reported an error');
  assert.equal(s.world?.state,'home');
  assert.equal(s.world?.characterReady,true);
  assert.equal(s.candidate?.staticHomeInstantiated,false,'Old fused static-home character is active');
  assert(s.candidate?.meshNames?.length > 0,'No dynamic character renderer identity');
  assert(s.motion?.availableClips?.length > 0,'No imported animation clips');
  assert(s.motion?.clip,'No selected animation clip');
  assert.equal(s.layout?.managedBoards,0,'Board leaked into initial home');
  assert.equal(s.engineVersion,lib.ENGINE);
  assert(s.renderers.active > 0,'No enabled active mesh renderers');
  assert.equal(s.renderers.missingMaterials,0,'Active renderer has an empty material slot');
  assert(s.canvas.width > 0 && s.canvas.height > 0,'Game canvas has no drawable extent');
  assert(s.webglContext,'Game canvas has no live WebGL context');
  return true;
}

async function browserSnapshot() {
  // This function is serialized and executed inside the actual browser page.
  const api = globalThis.__worldIntegration;
  const loading = globalThis.__worldLoading;
  if (!api || !loading) return {loading:loading?.snapshot?.() || null, api:false};
  if (!globalThis.System?.import) throw Error('Cocos module loader is unavailable');
  const cc = await globalThis.System.import('cc');
  const scene = cc.director.getScene();
  const renderers = scene.getComponentsInChildren(cc.MeshRenderer).filter(r => r.enabled && r.node.activeInHierarchy);
  const canvas = cc.game.canvas;
  let gl = null;
  try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); } catch {}
  return {api:true, loading:loading.snapshot(), world:api.snapshot(), layout:api.layout(),
    candidate:globalThis.__characterCandidateIdentity || null, motion:loading.motion?.() || null,
    morph:api.morph?.() || null, engineVersion:cc.VERSION, sceneName:scene.name,
    // The serialized current scene's legacy display name is FirstsliceImport.
    // Provenance and the built launch UUID/URL identify it, not sceneName alone.
    renderers:{active:renderers.length,missingMaterials:renderers.reduce((n,r)=>n + (r.sharedMaterials.length?r.sharedMaterials.filter(m=>!m).length:1),0)},
    canvas:{width:canvas.width,height:canvas.height}, webglContext:!!gl && !gl.isContextLost(),
    viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
    navigation:api.navigationStatus?.() || null};
}

async function runStartupSmoke(page, options) {
  const {url,artifactDir,provenanceFile,sourceRoot,evidenceDir} = options;
  assert(/^https?:\/\//.test(url),'Use an approved HTTP(S) URL, not file://');
  const parsedURL=new URL(url);
  assert(parsedURL.pathname.endsWith('/')&&!parsedURL.search&&!parsedURL.hash,'Supply the build base URL with a trailing slash and no query/hash');
  assert.equal(page.url(),'about:blank','Supply a fresh owned disposable page, not an existing user tab');
  const state = await page.context().storageState();
  assert.deepEqual(state,{cookies:[],origins:[]},'Refuse a context containing prior user/session data');
  assert(!fs.existsSync(evidenceDir),'Evidence directory must be new');
  fs.mkdirSync(evidenceDir,{recursive:true});
  const source = lib.sourceIdentity(sourceRoot);
  const artifact = lib.verifyArtifact(artifactDir,{expectedBundles:source.expectedBundles}), provenance = lib.json(provenanceFile);
  assert.equal(provenance.creatorExitCode,36);
  assert.equal(provenance.engine,lib.ENGINE);
  assert.equal(provenance.sceneUuid,lib.SCENE_UUID);
  assert.equal(provenance.sceneUrl,lib.SCENE_URL);
  assert.equal(provenance.artifactSha256,artifact.sha256);
  assert.equal(provenance.sourceSha256,source.sha256);
  const report = {startedAt:new Date().toISOString(),status:'RUNNING',url,sourceSha256:provenance.sourceSha256,
    artifactSha256:artifact.sha256,errors:[],checks:[],visualAcceptance:'NOT_REVIEWED',
    limits:['Startup-only runtime smoke; navigation/board/recovery acceptance remains separate.',
      'Screenshots require human visual inspection for character, materials, animation, and contact quality.',
      'No WeChat API, real mobile lifecycle, phone performance, or user save acceptance.']};
  const onError=e=>report.errors.push(String(e.stack || e));
  const onConsole=m=>{if(m.type()==='error')report.errors.push(m.text());};
  const onRequest=r=>report.errors.push('REQUEST_FAILED ' + r.url() + ' ' + r.failure()?.errorText);
  const onResponse=r=>{if(r.status()>=400)report.errors.push('HTTP_' + r.status() + ' ' + r.url());};
  page.on('pageerror',onError); page.on('console',onConsole); page.on('requestfailed',onRequest); page.on('response',onResponse);
  try {
    const capability = await page.evaluate(()=> {
      const canvas=document.createElement('canvas');
      const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
      const result={webgl:!!gl,version:gl?.getParameter(gl.VERSION)||null};
      gl?.getExtension('WEBGL_lose_context')?.loseContext(); return result;
    });
    report.capability=capability;
    if (!capability.webgl) { report.status='BLOCKED_WEBGL'; return report; }
    // Check the bytes actually served, not merely a local filename or user-supplied label.
    // All files are checked to catch a mixed old/new deployment or missing asset.
    for (const file of artifact.entries) {
      const target=new URL(file.path.split('/').map(encodeURIComponent).join('/'),url.endsWith('/')?url:url+'/').href;
      const response=await page.request.get(target);
      assert(response.ok(),'Artifact HTTP failure: ' + target + ' ' + response.status());
      assert.equal(lib.sha(await response.body()),file.sha256,'Served artifact bytes mismatch: ' + file.path);
      await response.dispose();
    }
    report.checks.push({servedArtifactFiles:artifact.files,allSha256Match:true});
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>globalThis.__worldLoading?.snapshot?.().phase==='ready',null,{timeout:120000});
    // Allow the actual next two engine/browser presentation frames before a snapshot.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const first=await page.evaluate(browserSnapshot);
    assertStartup(first);
    report.checks.push({name:'current-scene-home-startup',snapshot:first});
    await page.screenshot({path:path.join(evidenceDir,'home-startup.png'),fullPage:false});
    assert.deepEqual(report.errors,[],'Browser/network errors occurred');
    report.status='STARTUP_SMOKE_PASSED_VISUAL_REVIEW_OPEN';
    return report;
  } catch(error) {
    report.status='FAILED'; report.error=String(error.stack || error);
    await page.screenshot({path:path.join(evidenceDir,'failure.png'),fullPage:false}).catch(()=>{});
    return report;
  } finally {
    page.off('pageerror',onError); page.off('console',onConsole); page.off('requestfailed',onRequest); page.off('response',onResponse);
    report.finishedAt=new Date().toISOString(); lib.write(path.join(evidenceDir,'runtime-report.json'),report);
  }
}
module.exports = {assertStartup,browserSnapshot,runStartupSmoke};
