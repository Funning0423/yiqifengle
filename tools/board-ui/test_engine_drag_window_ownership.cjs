'use strict';
// Actual production TS/controller; uses the same explicitly modeled raw/node seam.
// Direct-END compatibility cases intentionally exercise the app branch directly,
// not a claim that Cocos emits END on a source node missed by the release point.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),crypto=require('crypto');
const target=path.join(__dirname,'test_engine_drag_release.cjs'),fixture=fs.readFileSync(target,'utf8');
const cut=fixture.indexOf('(async () => {');assert(cut>0);
const fixtureModule=new Module(target);fixtureModule.filename=target;fixtureModule.paths=Module._nodeModulePaths(__dirname);
fixtureModule._compile(fixture.slice(0,cut)+'\nmodule.exports={actual,deliver,state,untouched,committed,ROOT};',target);
const {actual,deliver,state,untouched,committed,ROOT}=fixtureModule.exports,results=[];
const file=path.join(ROOT,'creator-build-project/assets/scripts/ManagedMobileBoardUI.ts');
const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');const sourceSha256=hash();
async function test(name,fn){try{const detail=await fn();results.push({name,ok:true,...detail});console.log('PASS',name);}catch(e){results.push({name,ok:false,error:e.stack});console.error('FAIL',name,e.message);}}
(async()=>{
 for(const kind of ['piece','tool'])for(const route of ['direct-END-compatibility','adapted-CANCEL'])for(const startWindow of [0,17])for(const ending of ['foreign-end','return-origin','return-outside','return-true-cancel','return-valid-end','owner-move-then-foreign-move']){
  await test(`${kind}/${route}/window${startWindow}/${ending}`,async()=>{
   const b=await actual(),{H,u,c}=b;try{
    const n=kind==='piece'?u.cells[23]:u.tools[0],a=H.point(n),z=H.point(u.cells[kind==='piece'?24:0]);
    const send=(raw,p,w)=>deliver(H,n,raw,p,81,{event:{windowId:w}});
    const end=(p,w)=>{if(route==='adapted-CANCEL')return send('touch-end',p,w);const e={...H.event(p,81,'touch-end'),type:'touch-end',target:n,currentTarget:n,windowId:w};n.emit('touch-end',e);return e;};
    send('touch-start',a,startWindow);const drag=()=>kind==='piece'?u.dragStart:u.toolDrag;
    assert(drag());
    if(ending==='owner-move-then-foreign-move')send('touch-move',z,startWindow);
    const held=drag(),before=JSON.parse(JSON.stringify(held));
    const foreignPoint=ending==='owner-move-then-foreign-move'?H.point(u.cells[kind==='piece'?22:1]):z;
    send('touch-move',foreignPoint,99);
    assert.equal(drag(),held,'foreign window cannot replace the owning gesture');
    assert.deepEqual(drag(),before,'foreign MOVE cannot alter coordinates, destination, ownership or window');
    end(foreignPoint,99);untouched(c);
    assert.equal(drag(),held,'foreign END cannot end the original owner');
    assert.deepEqual(drag(),before,'foreign END cannot alter owned geometry');
    if(ending==='return-origin'||ending==='owner-move-then-foreign-move'){end(a,startWindow);untouched(c);}
    if(ending==='return-outside'){end({x:-100,y:-100},startWindow);untouched(c);}
    if(ending==='return-true-cancel'){send('touch-cancel',z,startWindow);untouched(c);end(z,startWindow);untouched(c);}
    if(ending==='return-valid-end'){end(z,startWindow);committed(c,kind);end(z,startWindow);committed(c,kind);}
    return{startWindow,windowAfterForeignMove:before.sw,originWindow:held.originWindow,final:state(c),interpretation:ending==='return-valid-end'?'Only the new explicit owner-window endpoint authorizes the action':'No foreign-window history authorizes an action'};
   }finally{u.onDestroy();}
  });
 }
 for(const kind of ['piece','tool'])await test(`${kind}/foreign START and CANCEL cannot rebind owner`,async()=>{const b=await actual(),{H,u,c}=b;try{const n=kind==='piece'?u.cells[23]:u.tools[0],a=H.point(n),z=H.point(u.cells[kind==='piece'?24:0]);const send=(raw,p,w)=>deliver(H,n,raw,p,1,{event:{windowId:w}});send('touch-start',a,0);const held=kind==='piece'?u.dragStart:u.toolDrag;const before=JSON.parse(JSON.stringify(held));send('touch-start',a,99);send('touch-cancel',z,99);assert.deepEqual(kind==='piece'?u.dragStart:u.toolDrag,before);untouched(c);send('touch-move',z,0);send('touch-end',z,0);committed(c,kind);return{final:state(c)};}finally{u.onDestroy();}});
 for(const kind of ['piece','tool'])for(const route of ['direct-END-compatibility','adapted-CANCEL'])for(const invalidWindow of ['missing','NaN','Infinity','-Infinity'])await test(`${kind}/${route}/rejects ${invalidWindow} START window`,async()=>{const b=await actual(),{H,u,c}=b;try{const n=kind==='piece'?u.cells[23]:u.tools[0],a=H.point(n),z=H.point(u.cells[kind==='piece'?24:0]);const windowId=invalidWindow==='missing'?undefined:Number(invalidWindow);const opts={event:{windowId},mutate:invalidWindow==='missing'?(e)=>{delete e.windowId;}:undefined};deliver(H,n,'touch-start',a,1,opts);assert.equal(u.dragStart,null);assert.equal(u.toolDrag,null);deliver(H,n,'touch-move',z,1,opts);if(route==='adapted-CANCEL')deliver(H,n,'touch-end',z,1,opts);else{const e={...H.event(z,1,'touch-end'),type:'touch-end',target:n,currentTarget:n,windowId};if(invalidWindow==='missing')delete e.windowId;n.emit('touch-end',e);}untouched(c);return{final:state(c)};}finally{u.onDestroy();}});
 await test('source unchanged',()=>assert.equal(hash(),sourceSha256));
 const report={status:results.every(r=>r.ok)?'PASS':'FAIL',source:ROOT,sourceSha256,testSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),fixtureSha256:crypto.createHash('sha256').update(fixture).digest('hex'),scope:'Immutable START-window ownership with raw/node event doubles; direct-END app compatibility branch also checked. No actual OS multi-window or mouse conversion run.',checks:results.length,failed:results.filter(r=>!r.ok).length,results};
 if(process.env.QF_DRAG_WINDOW_REPORT)fs.writeFileSync(process.env.QF_DRAG_WINDOW_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined}));if(report.failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});
