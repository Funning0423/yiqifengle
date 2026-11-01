'use strict';
// 运镜bot full7-cam: ?camTrace=1 / __QF_CAM_TRACE console trace. Off by default: no hook, no output, camTag inert.
// On: one well-formed console.log line per write, writer names, CHANGE / JUMP flags. Wiring: every named writer tags itself.
const fs=require('fs');const src0=f=>fs.readFileSync(require('./journey-scene.cjs').S+f,'utf8');const {H,S}=require('./journey-scene.cjs');
const L=H.load(S+'region/CamTraceLog.ts'),CP=H.load(S+'world-r1/CameraPose.ts');
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
const logs=[];const orig={log:console.log,warn:console.warn,error:console.error,info:console.info};
const PN=/ pn=[0-9.]+$/;// full9c probes: every trace line ends with pn=performance.now(); the format checks below ignore it
const cap=k=>(...a)=>{const s=a.join(' ');if(k==='log'&&/^\[QF_CAM_TRACE\]/.test(s)&&!PN.test(s))throw Error('trace line without pn: '+s);logs.push([k,s.replace(PN,'')]);};
const cam={node:{setWorldPosition(){},setWorldRotation(){}},fov:45};
function write(p,src){return CP.applyCameraPose(cam,p,src);}
const q=yawDeg=>{const h=-yawDeg*Math.PI/360;return [0,Math.sin(h),0,Math.cos(h)];};// rotation about Y
const P=(x,yawDeg)=>({position:[x,1,0],rotation:q(yawDeg),fovVerticalDeg:45});
// OFF
console.log=cap('log');console.warn=cap('warn');console.error=cap('error');console.info=cap('info');
L.camLogReset();const on0=L.camLogStart('',{});
L.camTag('BalloonTransit:B1');for(let i=0;i<5;i++)write(P(i,0),'world.setCamera');
Object.assign(console,orig);
ok(on0===false,'default off');ok(CP.cameraWriteHook.log===null,'off: no hook installed');ok(L.camLog.tag==='','off: camTag inert');
ok(logs.filter(l=>/QF_CAM_TRACE/.test(l[1])).length===0&&logs.length===0,'off: no console output '+JSON.stringify(logs));
ok(L.camLogStart('?camTrace=1',{})===false,'switch read once per page');
// full8: __QF_CAM_TRACE accepts exactly true / 1 / '1' ('true'); everything else stays off
for(const v of [true,1,'1','true'])ok(L.camLogEnabled('',{__QF_CAM_TRACE:v})===true,'switch on for '+JSON.stringify(v));
for(const v of [false,0,'0','false','',null,undefined,2,'yes',{}])ok(L.camLogEnabled('',{__QF_CAM_TRACE:v})===false,'switch off for '+JSON.stringify(v));
ok(L.camLogEnabled('?camTrace=1',{})===true&&L.camLogEnabled('?camTrace=0',{})===false&&L.camLogEnabled('',null)===false,'query switch');
// ON (query) and ON (global)
for(const [qs,g] of [['?a=2&camTrace=1',{}],['',{__QF_CAM_TRACE:1}],['',{__QF_CAM_TRACE:true}],['',{__QF_CAM_TRACE:'1'}]]){
 logs.length=0;L.camLogReset();console.log=cap('log');console.warn=cap('warn');console.error=cap('error');
 const on=L.camLogStart(qs,g);
 L.camTag('BalloonTransit:B1');write(P(0,0),'world.setCamera');
 L.camTag('BalloonTransit:B1');write(P(0.05,1),'world.setCamera');
 L.camTag('regionBoardHandoff');write(P(0.1,2),'skycity.landing-board');
 L.camTag('enter-level');write(P(3,40),'world.enterLevel');
 write(P(3,40),'world.setCamera');
 Object.assign(console,orig);
 ok(on===true,'on via '+(qs||'global'));ok(CP.cameraWriteHook.log===L.camLogWrite,'on: hook installed');
 ok(logs.every(l=>l[0]==='log'),'on: console.log only '+JSON.stringify(logs.map(l=>l[0])));
 const RX=/^\[QF_CAM_TRACE\] f=\d+ t=-?[\d.]+ pos=-?[\d.]+,-?[\d.]+,-?[\d.]+ yaw=-?[\d.]+ pitch=-?[\d.]+ fov=[\d.]+ w=\S+( CHANGE<-\S+)?( JUMP=[\d.]+m\/[\d.]+deg)?$/;
 ok(logs.length===5&&logs.every(l=>RX.test(l[1])),'on: 5 well-formed lines '+JSON.stringify(logs));
 const w=logs.map(l=>l[1].match(/ w=(\S+)/)[1]);ok(JSON.stringify(w)===JSON.stringify(['BalloonTransit:B1','BalloonTransit:B1','regionBoardHandoff','enter-level','world.setCamera']),'writers '+w);
 ok(!/CHANGE|JUMP/.test(logs[1][1]),'no flag inside one writer within caps');ok(/CHANGE<-BalloonTransit:B1/.test(logs[2][1]),'writer change flagged');
 ok(/JUMP=/.test(logs[3][1])&&/CHANGE<-regionBoardHandoff/.test(logs[3][1]),'cut flagged as JUMP');
 const y=+logs[3][1].match(/yaw=(-?[\d.]+)/)[1];ok(Math.abs(Math.abs(y)-40)<1e-3,'yaw decoded '+y);
}
// per-frame state lines (camera disabled / world layer off)
{const out=[];L.camLogReset();L.camLogStart('?camTrace=1',{});L.camLog.out=x=>out.push(String(x).replace(PN,''));
 const c={node:{isValid:true},enabledInHierarchy:true,visibility:(1<<30)|1};L.camLogFrame(c);
 c.enabledInHierarchy=false;L.camLogFrame(c);c.enabledInHierarchy=true;c.visibility=1;L.camLogFrame(c);c.visibility=(1<<30);L.camLogFrame(c);L.camLogFrame(null);
 ok(out.length===4&&/^\[QF_CAM_TRACE\] frame=2 CAM_OFF/.test(out[0])&&/frame=3 WORLD_LAYER_OFF vis=0x1$/.test(out[1])&&/frame=4 CAM_OK<-WORLD_LAYER_OFF/.test(out[2])&&/frame=5 CAM_MISSING/.test(out[3]),'state lines '+JSON.stringify(out));
 L.camLog.out=s=>console.log(s);}
// ACTOR_STALL: walking her moves → no line; unchanged > 3 s while active → one line (every 3 s); inactive / moving resets; off → silent
{const out=[];L.camLogReset();L.camLogStart('?camTrace=1',{});L.camLog.out=x=>out.push(String(x).replace(PN,''));
 for(let i=0;i<300;i++)L.camActorProbe(i*0.02,0,0,true,'C1',i/60);ok(out.length===0,'walking: no stall '+out);
 for(let i=0;i<=400;i++)L.camActorProbe(6,0,0,true,'C1',5+i/60);ok(out.length===2&&/^\[QF_CAM_TRACE\] t=[\d.]+ ACTOR_STALL step=C1 heldS=3\.0\d* her=6,0,0$/.test(out[0]),'stall lines '+JSON.stringify(out));
 out.length=0;for(let i=0;i<=400;i++)L.camActorProbe(6,0,0,false,'C1',20+i/60);ok(out.length===0,'inactive step: no stall');
 L.camLog.out=s=>console.log(s);L.camLogReset();const o2=[];L.camLog.out=x=>o2.push(String(x).replace(PN,''));for(let i=0;i<=400;i++)L.camActorProbe(6,0,0,true,'C1',i/60);ok(o2.length===0,'off: no stall line');L.camLog.out=s=>console.log(s);}
{const a=src0('region/RegionJourneyAdapter.ts'),b=src0('region/BalloonTransit.ts');ok(/if\(camLog\.on&&sl&&girl&&isValid\(girl,true\)\)\{const gp=girl\.worldPosition;camActorProbe\(gp\.x,gp\.y,gp\.z,!boarded,'C1'\);\}/.test(a)&&/camActorProbe\(gp\.x,gp\.y,gp\.z,true,'B1'\)/.test(b),'wiring: C1 / B1 stall probes behind camLog.on');
 ok(!/camActorProbe[^;]*setCamera/.test(a+b),'probe never writes the camera');}
L.camLogReset();
{let n=0;const out=[];L.camLog.out=x=>out.push(String(x).replace(PN,''));L.camLogFrame(null);ok(out.length===0,'off: camLogFrame silent');L.camLog.out=s=>console.log(s);}
ok(/lateUpdate\(dt:number\):void \{if\(camLog\.on\)camLogFrame\(this\.worldCamera\);/.test(src0('world-r1/WorldFlowComponent.ts')),'wiring: lateUpdate probe behind camLog.on');
// wiring
const src=f=>fs.readFileSync(S+f,'utf8');
const need={'region/BalloonTransit.ts':['BalloonTransit:prewalk','BalloonTransit:B1','BalloonTransit:flight','BalloonTransit:B5'],'world-r1/RegionJourneyCore.ts':['TransitionCamera','LiveHandoff','RegionJourneyCore:onFrame'],
 'region/RegionJourneyAdapter.ts':['SkyWalkShot'],'world-r1/WorldFlowComponent.ts':['enter-level'],'region/RegionBoardLanding.ts':['regionBoardHandoff','regionLandingToBoard']};
for(const [f,names] of Object.entries(need)){const s=src(f);for(const n of names)ok(s.includes("camTag('"+n+"')")||s.includes("CT()?.t('"+n+"')")||s.includes("CT()?.d('"+n+"')"),`wiring ${f} tags ${n}`);}
ok(/\ncamLogStart\(\);\s*$/.test(src('region/CamTraceLog.ts')),'wiring: switch read once at module load');
ok(/import \{ camTag[^}]*\} from '\.\.\/region\/CamTraceLog'/.test(src('world-r1/WorldFlowComponent.ts')),'wiring: WorldFlowComponent loads CamTraceLog (init)');
{const g={};L.camLogReset();L.camLogStart('',g);ok(g.__qfCamTag===undefined,'off: no __qfCamTag published');L.camLogReset();L.camLogStart('?camTrace=1',g);ok(typeof g.__qfCamTag?.t==='function','on: __qfCamTag published');L.camLogReset();}
ok(!/console\.(warn|error)/.test(src('region/CamTraceLog.ts')),'CamTraceLog never warns/errors');
ok(fs.existsSync(S+'region/CamTraceLog.ts.meta'),'meta present');
console.log(JSON.stringify({status:fail?'FAIL':'PASS'}));process.exit(fail?1:0);
