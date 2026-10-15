'use strict';
// Task-21 Web UI harness: disposable persistent Chromium profiles under output/task21-ui/, isolated task21 namespaces only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const env=require('../qf-env.cjs');
const ROOT=path.resolve(__dirname,'../..');
const BASE=process.env.TASK21_WEB_URL||'http://127.0.0.1:8781/';
const OUT=path.join(ROOT,'output/task21-ui');
const EVIDENCE=path.join(ROOT,'evidence/task21-ui');
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(EVIDENCE,{recursive:true});
const VIEWPORT={width:402,height:874};

function runId(){return crypto.randomUUID().replace(/-/g,'').slice(0,16);}
function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function buildIdentity(){const dir=path.join(ROOT,'creator-build-project/build/web-task21-ui');const files=['index.html','index.js','application.js'].map(f=>path.join(dir,f)).filter(f=>fs.existsSync(f));
 let settings=null;try{const s=fs.readdirSync(path.join(dir,'src')).find(f=>/^settings\..*json$/.test(f));if(s)settings={file:'src/'+s,sha256:sha256(path.join(dir,'src',s))};}catch{}
 let commit=null;try{commit=require('node:child_process').execSync('git rev-parse HEAD',{cwd:ROOT,encoding:'utf8'}).trim();}catch{}
 return {url:BASE,buildDir:path.relative(ROOT,dir),sourceCommit:commit,files:files.map(f=>({file:path.relative(dir,f),sha256:sha256(f)})),settings};}

/** Persistent profile so a later launch on the same directory is a true cold browser-process restart. */
async function launch(profile,{query='',errors=[],logs=[],viewport=VIEWPORT}={}){
 const {chromium}=env.playwright();
 const context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:env.chromiumExecutable(),viewport,deviceScaleFactor:2,hasTouch:true});
 const page=context.pages()[0]||await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{const t=m.text();if(m.type()==='error')errors.push(t);if(logs.length<400&&/WORLD_STARTUP_READY|TASK21|error|Error/.test(t))logs.push({type:m.type(),text:t.slice(0,400)});});
 await page.goto(BASE+query,{waitUntil:'networkidle',timeout:120000});
 await page.waitForFunction(()=>{try{const s=__worldIntegration.snapshot();return s.state==='home'&&s.characterReady!==false;}catch{return false;}},{},{timeout:180000});
 return {context,page};
}
const api=(page,fn,arg)=>page.evaluate(fn,arg);
async function waitState(page,state,timeout=120000){await page.waitForFunction(s=>{try{return __worldIntegration.snapshot().state===s;}catch{return false;}},state,{timeout});}
/** Waits for a live (non-zero, settled) host hit area, e.g. the signpost only accepts taps after its entrance. */
async function nav(page,key,timeout=60000){const rect=()=>page.evaluate(k=>{try{const r=__worldIntegration.layout().targetRects[k];return r&&r.width>0&&r.height>0?r:null;}catch{return null;}},key);
 const t0=Date.now();let prev=null;for(;;){const r=await rect();if(r&&prev&&Math.abs(r.x-prev.x)<.5&&Math.abs(r.y-prev.y)<.5&&Math.abs(r.width-prev.width)<.5)break;prev=r;if(Date.now()-t0>timeout)throw Error('nav target not live: '+key);await page.waitForTimeout(150);}
 const q=await page.evaluate(k=>__worldIntegration.layout().targets[k],key);await page.touchscreen.tap(q.x,q.y);return q;}
const board=page=>page.evaluate(()=>__worldIntegration.board());
async function tapCell(page,i){const q=(await board(page)).layout.tiles[i];await page.touchscreen.tap(q.x,q.y);}
async function tapBoardTarget(page,key){const b=await board(page),q=b.layout.targets[key];if(!q)throw Error('board target missing: '+key+' have '+Object.keys(b.layout.targets).join(','));await page.touchscreen.tap(q.x,q.y);return q;}
/** Drive one swap with two real taps and wait for the checkpoint to record it. */
async function swap(page,a,b,expectedActions){await tapCell(page,a);await tapCell(page,b);
 await page.waitForFunction(n=>{const d=__worldIntegration.board();return d&&d.checkpoint&&d.checkpoint.actions.length===n&&!d.snapshot.visual&&['run.ready','result.saved'].includes(d.snapshot.state);},expectedActions,{timeout:60000});}
async function shot(page,name){const file=path.join(EVIDENCE,name);await page.screenshot({path:file,scale:'css'});return {file:path.relative(ROOT,file),sha256:sha256(file)};}
function write(name,data){const file=path.join(EVIDENCE,name);fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');return path.relative(ROOT,file);}
/** Physical localStorage rows for one root (prefix), read in-page. */
const storageRows=(page,prefix)=>page.evaluate(p=>{const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(p))out[k]=localStorage.getItem(k);}return out;},prefix);
/** Active Cocos nodes under a popup (or the whole scene) with screen rects; same frame mapping as layout(). */
const nodes=(page,{popup=null,name=null,text=null}={})=>page.evaluate(async({popup,name,text})=>{const {director,UITransform,Label}=await System.import('cc');const W=innerWidth,H=innerHeight,out=[];
 const visit=(n,inPopup)=>{if(!n.activeInHierarchy)return;const here=inPopup||(!popup||n.name===popup);if(here){const t=n.getComponent(UITransform);if(t){const label=n.getComponentsInChildren(Label).map(l=>l.string).filter(Boolean).join('|');if((!name||n.name===name||(name.endsWith('*')&&n.name.startsWith(name.slice(0,-1))))&&(!text||label.includes(text))){const b=t.getBoundingBoxToWorld();out.push({name:n.name,label:label.slice(0,80),x:b.x+W/2,y:H/2-b.y-b.height,width:b.width,height:b.height,cx:b.x+b.width/2+W/2,cy:H/2-b.y-b.height/2});}}}for(const c of n.children)visit(c,here);};
 visit(director.getScene(),false);return out;},{popup,name,text});
async function tapNode(page,spec,timeout=30000){const t0=Date.now();let hit=[];while(Date.now()-t0<timeout){hit=await nodes(page,spec);if(hit.length)break;await page.waitForTimeout(200);}
 if(!hit.length)throw Error('node not found '+JSON.stringify(spec)+' popups='+JSON.stringify((await board(page))?.popups));const n=hit[hit.length-1];await page.touchscreen.tap(n.cx,n.cy);return n;}
const popups=async page=>((await board(page))?.popups)||[];
const allKeys=page=>page.evaluate(()=>{const out=[];for(let i=0;i<localStorage.length;i++)out.push(localStorage.key(i));return out.sort();});
module.exports={ROOT,BASE,OUT,EVIDENCE,VIEWPORT,runId,sha256,buildIdentity,launch,api,waitState,nav,board,tapCell,tapBoardTarget,swap,shot,write,storageRows,allKeys,nodes,tapNode,popups};
