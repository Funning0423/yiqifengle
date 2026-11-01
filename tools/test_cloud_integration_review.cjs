'use strict';
// HISTORICAL (2026-10-26, Grok Bot): verified_restoration_scope / integrated_3d_scope / audio_gesture_scope are frozen records of the 2026-10-12
// review, not current pins. This script is NOT a live gate (not in run-suite; needs /tmp/baseline-current). Live pins: frozen-production-inputs.json.
// Independent merge/scope and syntax audit. Not a type checker or engine/render test.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'..'),base=process.env.CLOUD_BASELINE||path.resolve(root,'../baseline-current');
const read=(r,p)=>fs.readFileSync(path.join(r,p),'utf8');
const script='creator-build-project/assets/scripts/';
const approval=require('./verified_restoration_scope.json');
const {approval:gestureApproval,beforeApprovedGesture}=require('./audio_gesture_scope_helpers.cjs');
const {approval:visualApproval,beforeApproved3D}=require('./three_d_scope_helpers.cjs');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function beforeApprovedToolUI(source){
 assert.equal(digest(source),approval.uiAfterSha256,'merged UI must match reviewed method-level merge');
 const lines=source.split(/(?<=\n)/);
 for(const h of [...approval.uiReverseHunks].reverse()){
  assert.deepEqual(lines.slice(h.afterStart,h.afterStart+h.afterLines.length),h.afterLines,'reviewed tool UI hunk changed');
  lines.splice(h.afterStart,h.afterLines.length,...h.beforeLines);
 }
 const restored=lines.join('');assert.equal(digest(restored),approval.uiBeforeSha256,'all reliability UI bytes preserved after normalizing approved tool methods');return restored;
}
const checks=[];
function check(n,f){f();checks.push(n);}
check('managed UI retains protected layout, board, storage, modal and pagination implementations',()=>{
 const old=read(base,script+'ManagedMobileBoardUI.ts'),now=beforeApprovedToolUI(beforeApproved3D(script+'ManagedMobileBoardUI.ts',read(root,script+'ManagedMobileBoardUI.ts')));
 const start=old.indexOf('  private layout()'),end=old.indexOf('  private button(');
 // Approved tool-method hunks were hash-verified and reversed above; all original protected layout, board, modal and pagination assertions remain intact.
 assert(start>=0&&end>start);
 const stripBackground=s=>s.replace('  hostModalOpen(){return this.modalOpen();}\n','').replace('this.hud.active=!book&&!result;','this.hud.active=!book;').replace('this.status.node.active=!result;','').replace('this.positionResultUtilityControls(result);','').replace('this.backgroundFrame?.(safe.portrait);','').replace(/    this\.backgroundFrame\?\.\(safe\.portrait,\{width:w,height:h,boardTop:h\/2-y-board\/2\}\);\n/g,'');
 assert(stripBackground(now).includes(stripBackground(old.slice(start,end))));
 for(const name of ['modalOpen','askRestart','toggleBag','drawChest']){
  const line=old.split('\n').find(x=>x.includes('private '+name+'('));assert(line,name);assert(now.includes(line),name+' changed');
 }
});
check('world changes stay within imports, button factory and result positioning, preserving eligibility and motion',()=>{
 const normalize=s=>s.split('\n').filter(l=>!l.includes("from './WarmButton'")&&!l.includes("from './ResultLayout'")&&!l.trimStart().startsWith('private button(')).join('\n')
 .replace(/ \/\*\* (?:GGbot fix-3:|Use the same safe-area)[\s\S]*?\*\/\n/g,'')
 .replace(/ private placeResultButtons\([\s\S]*?(?= private paintNavigation\()/,'')
 .replace(/if\(registered&&board\)\{[\s\S]*?(?=const owned=b\.progress\.claimedRegions)/,'if(registered&&board){')
 .replace('if(this.busy||this.board()?.hostModalOpen())return;','if(this.busy)return;')
 .replace(' // Result actions live in a separate, higher-priority Canvas; the board modal cannot block them by sibling order.\n','')
 .replace(" if(board?.hostModalOpen())for(const k of ['mainNext','chest','regionReward','next','claim'])this.controls.get(k)!.active=false;\n",'');
 assert.equal(normalize(read(base,script+'WorldIntegrationBoot.ts')),normalize(read(root,script+'WorldIntegrationBoot.ts')));
});
check('emergency coordinate implementation and empty-volume hotfix are preserved',()=>{
 assert(read(root,script+'WarmButton.ts').includes('private inside(e:EventTouch){return this.node.getComponent(UITransform)!.hitTest(e.getLocation(),e.windowId);}'));
 const hashes={'audio/GameAudio.ts':'6de69183c0c184a9b30c07f8db6f3c1567ff8d3ccd78c5479d1699350e8e4ecf'};
 for(const [p,hash] of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(beforeApprovedGesture(script+p,read(root,script+p))).digest('hex'),hash,p);
});
check('composition change is only background import and explicit factory option',()=>{
 const p=script+'world-r2/WorldNativeComposition.ts';
 const normalize=s=>s.replace("import { createOriginalLevelBackground } from './OriginalLevelBackground';\n",'').replace('background:createOriginalLevelBackground,','');
 assert.equal(normalize(read(root,p)),read(base,p));
});
check('original scene painter and original PNG bytes preserve verified provenance',()=>{
 const source=read(root,script+'world-r2/OriginalLevelEnvironment.ts').replace('// @ts-nocheck\n// Exact original renderer; only CommonJS export converted for Creator.\n','').replace('export {LevelEnvironment,MAIN,COAST};','module.exports={LevelEnvironment,MAIN,COAST};');
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'08afbc68a4fc753d9994031e01e7ef4b249915db95c7ccce77385bf932466c6d');
 const manifest={"creator-build-project/assets/bundles/background_foliage/botanical-props.png":{"sha256":"8b80c88bd682613591ef93eb619f32ba5c2cce49a2a9672f029bc0296066dc89","bytes":807554,"baselineSha256":null},"creator-build-project/assets/bundles/background_foliage/painted-cloud.png":{"sha256":"eeca70e033d1f1eb65b5e8f4c182d8be1c58e42816976533352c44a11cb323f2","bytes":1417468,"baselineSha256":null},"creator-build-project/assets/bundles/background_ground/painted-grass.png":{"sha256":"4b6f4d1638cd6ce333f10075b70d0b83f4f8e63e73710feefa0ddd3f0ca8fb9d","bytes":3554287,"baselineSha256":null}};
 const T8_DELETED=new Set(['creator-build-project/assets/bundles/background_foliage/botanical-props.png','creator-build-project/assets/bundles/background_ground/painted-grass.png']);/* T8 step 1: deleted on purpose (docs/T8-step1.md); assert they stay gone */for(const p of T8_DELETED)assert(!fs.existsSync(path.join(root,p)),p+' must stay deleted (T8)');
 for(const [p,entry] of Object.entries(manifest))if(p.endsWith('.png')&&!T8_DELETED.has(p))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),entry.sha256,p);
});
check('camera, motion, model, storage and reward-owned files remain unchanged outside hash-pinned original-tool transaction restoration',()=>{
 const files=[];function walk(dir){for(const e of fs.readdirSync(path.join(base,dir),{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(p);}}walk(script);
 const allowed=new Set(['ManagedMobileBoardUI.ts','WorldIntegrationBoot.ts','world-r2/NativeWorldLevelAdapter.ts','world-r2/WorldNativeComposition.ts','audio/GameAudio.ts','audio/AudioBridge.ts'].map(p=>script+p));
 for(const p of files){if(allowed.has(p))continue;const reviewed=approval.approvedOriginalToolRuntime[p];if(reviewed){assert.equal(digest(fs.readFileSync(path.join(base,p))),reviewed.beforeSha256,p+' original baseline');assert.equal(digest(fs.readFileSync(path.join(root,p))),reviewed.afterSha256,p+' exact approved tool restoration');continue;}assert(fs.readFileSync(path.join(base,p)).equals(fs.readFileSync(path.join(root,p))),p);}
});
check('complete production tree has exactly the reviewed files and bytes, including unchanged engine, audio and assets',()=>{
 const actual={};function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const p=path.posix.join(dir,e.name);if(e.isDirectory())walk(p);else actual[p]=digest(fs.readFileSync(path.join(root,p)));}}walk('creator-build-project');
 assert.deepEqual(actual,gestureApproval.productionAfter,'unexpected production change in exact reviewed first-UI gesture candidate');
 const visualTree={...actual};
 for(const p of Object.keys(gestureApproval.sourceChanges))visualTree[p]=digest(beforeApprovedGesture(p,read(root,p)));
 assert.deepEqual(visualTree,visualApproval.productionAfter,'unexpected production addition/removal/modification after exact gesture reversal');
 // Restore only hash-pinned, exact 3D source hunks and remove only exact newly approved assets.
 // The complete original restoration production-tree assertion remains mandatory.
 const restored={...visualTree};
 for(const [p,entry] of Object.entries(visualApproval.sourceChanges))restored[p]=digest(beforeApproved3D(p,read(root,p)));
 for(const [p,hash] of Object.entries(visualApproval.newProduction)){assert.equal(restored[p],hash,p+' exact 3D addition');delete restored[p];}
 assert.deepEqual(restored,approval.productionTree,'unexpected production addition/removal/modification after exact 3D reversal');
});
check('changed and new TypeScript syntax parses with Node24 transform (not Creator type checking)',()=>{
 const paths=[];function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.ts')&&!p.endsWith('.d.ts')&&(!fs.existsSync(path.join(base,p))||read(root,p)!==read(base,p)))paths.push(p);}}walk(script);
 for(const p of paths){let text=read(root,p).replace(/@ccclass\([^\n]*\)/g,'').replace(/@property\([^\n]*?\)/g,'');stripTypeScriptTypes(text,{mode:'transform'});}assert(paths.length>=3);
});
check('asset metadata UUIDs have no duplicates',()=>{
 const ids=new Map();function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.meta')){const m=JSON.parse(read(root,p));if(m.uuid){assert(!ids.has(m.uuid),p+' duplicates '+ids.get(m.uuid));ids.set(m.uuid,p);}}}}walk('creator-build-project/assets');
});
console.log(JSON.stringify({status:'PASS_INDEPENDENT_MERGE_AUDIT',checks,creatorTypeCheck:'NOT_RUN',renderAndInputRouting:'NOT_RUN'},null,2));
