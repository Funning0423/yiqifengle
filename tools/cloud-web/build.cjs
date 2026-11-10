#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const lib = require('./lib.cjs');
const freeze = require('./freeze.cjs');
const ROOT = path.resolve(__dirname, '../..');

function args(argv) {
  const result = {};
  for (let i=0;i<argv.length;i++) {
    const key=argv[i];
    if (['--plan','--prepare','--execute'].includes(key)) result[key.slice(2)] = true;
    else if (['--creator','--run-id','--prepared-run'].includes(key) && argv[i+1] && !argv[i+1].startsWith('--')) result[key.slice(2)] = argv[++i];
    else throw Error('Unknown/incomplete argument: ' + key);
  }
  if (Number(!!result.plan) + Number(!!result.prepare) + Number(!!result.execute) !== 1) throw Error('Choose --plan, --prepare or --execute; no implicit launch.');
  return result;
}
async function main(argv) {
  const options = args(argv);
  const runId = options['run-id'] || new Date().toISOString().replace(/[:.]/g,'-') + '-' + crypto.randomUUID().slice(0,8);
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw Error('Unsafe run ID');
  const run = path.join(ROOT, 'output/cloud-web-build', runId);
  lib.safePath(ROOT,path.relative(ROOT,run));
  fs.mkdirSync(path.dirname(run), {recursive:true});
  fs.mkdirSync(run); // Refuse overwrite or accidental reuse of a stale run/package.
  const report = {runId, startedAt:new Date().toISOString(), status:'PREFLIGHT', hostPlatform:process.platform,
    mode:options.prepare?'PREPARATION_ONLY':'FORMAL_BUILD', engineBuild:'NOT_RUN', runtimeSmoke:'NOT_RUN', visualAcceptance:'NOT_RUN'};
  const writeRun=(name,value)=>lib.write(lib.inside(ROOT,path.relative(ROOT,path.join(run,name))),value);
  const save = () => writeRun('build-report.json', report);
  try {
    const input = lib.sourceIdentity(ROOT);
    writeRun('source-manifest.json', input);
    report.sourceSha256 = input.sha256;
    const tooling=lib.inventory(ROOT,['tools/cloud-web']);
    writeRun('tooling-manifest.json',tooling);report.toolingSha256=tooling.sha256;
    const config = {...lib.json(path.join(ROOT,lib.CONFIG_REL)), buildPath:path.join(run,'artifacts')};
    const configFile = lib.inside(ROOT,path.relative(ROOT,path.join(run,'resolved-build-options.json')));
    lib.write(configFile,config);
    const executable = options.creator ? path.resolve(options.creator) : null;
    const cliArgs = ['--project',path.join(ROOT,'creator-build-project'),'--build',`configPath=${configFile};logDest=${path.join(run,'creator.log')}`];
    // Semicolon is Creator's option delimiter even though no shell is involved.
    if ([configFile, path.join(run,'creator.log')].some(v => /[;\r\n]/.test(v))) throw Error('Project path contains Creator CLI parameter delimiters');
    report.command = {executable, args:cliArgs, shell:false};
    report.artifactPath = path.join(config.buildPath,config.outputName);
    report.blockers = [];
    for(const name of ['local','profiles']){
      const state=path.join(ROOT,'creator-build-project',name);
      if(!options['prepared-run']&&fs.existsSync(state)&&fs.readdirSync(state).length)report.blockers.push('Existing Creator '+name+' state may override unstated build defaults; use a fresh frozen source copy. No state is deleted automatically.');
    }
    if (!['win32','darwin'].includes(process.platform)) report.blockers.push('Official Creator 3.8 editor installation/CLI support is documented for Windows/macOS, not this ' + process.platform + ' host.');
    if (!executable) report.blockers.push('An explicitly verified official Cocos Creator 3.8.8 executable is required.');
    else if (!fs.existsSync(executable) || !fs.statSync(executable).isFile()) report.blockers.push('Creator executable not found.');
    if(options.prepare && options['prepared-run']) report.blockers.push('Preparation cannot consume another preparation run.');
    if(options.execute && !options['prepared-run']) report.blockers.push('Formal build requires --prepared-run from this isolated copy.');
    if (options.plan) { report.status='PLAN_ONLY'; save(); console.log(JSON.stringify(report,null,2)); return; }
    if (report.blockers.length) { report.status='BLOCKED'; save(); console.error(JSON.stringify(report,null,2)); process.exitCode=2; return; }
    const engineExecutable=freeze.engineIdentity(executable);
    if(options.prepare) report.baseline=freeze.assertBaseline(ROOT,input);
    else report.preparation=freeze.loadPrepared(ROOT,options['prepared-run'],input,tooling,engineExecutable);
    report.engineExecutable=engineExecutable;
    const stdout = fs.openSync(lib.inside(run,'stdout.log'),'wx'), stderr = fs.openSync(lib.inside(run,'stderr.log'),'wx');
    report.status='BUILD_RUNNING'; save();
    let result;
    try {
      result = await new Promise((resolve,reject) => {
        // No sandbox-disable, graphics, driver, login, install, or security flags.
        const child = cp.spawn(executable,cliArgs,{cwd:ROOT,shell:false,stdio:['ignore',stdout,stderr],timeout:30*60*1000});
        child.once('error',reject); child.once('exit',(code,signal) => resolve({code,signal}));
      });
    } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
    report.process = result;
    lib.assertCreatorExit(result);
    report.engineBuild='PROCESS_SUCCESS_36';
    const after = lib.sourceIdentity(ROOT);
    writeRun('source-manifest-after.json',after);
    require('node:assert/strict').deepEqual(freeze.engineIdentity(executable),engineExecutable,'Creator executable changed during process');
    const toolingAfter=lib.inventory(ROOT,['tools/cloud-web']);
    writeRun('tooling-manifest-after.json',toolingAfter);
    freeze.assertStable(tooling,toolingAfter,'Build tooling');
    if(options.prepare){
      // The known --build CLI performs import and build. This output is preparation-only.
      // Keep it separate; it receives neither artifact acceptance nor provenance.
      report.preparationChanges=freeze.changes(input,after);save();
      freeze.assertPreparationDelta(input,after);
      const receipt={schema:'qifengle-prepared-input/v1',policy:freeze.POLICY,runId,baseCommit:freeze.BASE_COMMIT,
        originalSourceSha256:input.sha256,frozenSourceSha256:after.sha256,toolingSha256:tooling.sha256,engineExecutable,
        creatorExitCode:36,createdAt:new Date().toISOString(),limits:['Opaque information metadata is included without parsing; no claim of harmlessness.',
          'Generated library/temp/build/node_modules remain outside the source fingerprint contract.',
          'Preparation output is not an accepted artifact. Formal build must pass strict before/after equality.']};
      writeRun('preparation.json',receipt);
      report.status='PREPARATION_FROZEN';report.engineBuild='PREPARATION_PROCESS_SUCCESS_36';report.finishedAt=new Date().toISOString();save();
      console.log(JSON.stringify(report,null,2));return;
    }
    if (input.sha256 !== after.sha256) throw Error('Source changed during import/build; review changes and rebuild from a new frozen source.');
    const artifact = lib.verifyArtifact(report.artifactPath,{expectedBundles:input.expectedBundles});
    writeRun('artifact-manifest.json',artifact);
    const provenance = {schemaVersion:1, runId, sourceSha256:input.sha256, toolingSha256:tooling.sha256, artifactSha256:artifact.sha256,
      preparation:report.preparation, creatorExitCode:36, engine:lib.ENGINE, sceneUuid:lib.SCENE_UUID, sceneUrl:lib.SCENE_URL,
      builtAt:new Date().toISOString(), limits:artifact.limits};
    // Sidecar is intentionally outside artifact to avoid a self-referential artifact hash.
    writeRun('provenance.json',provenance);
    report.artifactSha256=artifact.sha256; report.status='BUILD_AND_STRUCTURE_VERIFIED';
    report.engineBuild='VERIFIED_3.8.8_WEB_ARTIFACT'; report.finishedAt=new Date().toISOString(); save();
    console.log(JSON.stringify(report,null,2));
  } catch(error) { report.status='FAILED'; report.error=String(error.stack || error); report.finishedAt=new Date().toISOString(); save(); throw error; }
}
if (require.main === module) main(process.argv.slice(2)).catch(error=>{console.error(error.stack || error); process.exitCode=1;});
module.exports = {args,main};
