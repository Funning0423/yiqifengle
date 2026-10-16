#!/usr/bin/env node
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const lib = require('./lib.cjs');
try {
  const [artifact, provenanceFile, sourceRoot] = process.argv.slice(2);
  assert(artifact && provenanceFile && sourceRoot, 'Usage: node tools/cloud-web/verify.cjs ARTIFACT_DIR PROVENANCE_JSON SOURCE_ROOT');
  const source = lib.sourceIdentity(path.resolve(sourceRoot));
  const report = lib.verifyArtifact(path.resolve(artifact),{expectedBundles:source.expectedBundles});
  const provenance = lib.json(path.resolve(provenanceFile));
  assert.equal(provenance.creatorExitCode,36);
  assert.equal(provenance.engine,lib.ENGINE);
  assert.equal(provenance.sceneUuid,lib.SCENE_UUID);
  assert.equal(provenance.artifactSha256,report.sha256,'Artifact bytes differ from the build receipt');
  assert.equal(provenance.sourceSha256,source.sha256,'Artifact does not match the supplied current source');
  console.log(JSON.stringify({status:'SOURCE_AND_ARTIFACT_MATCH',sourceSha256:provenance.sourceSha256,artifactSha256:report.sha256,files:report.files,limits:report.limits},null,2));
} catch(error) { console.error(String(error.stack || error)); process.exitCode=1; }
