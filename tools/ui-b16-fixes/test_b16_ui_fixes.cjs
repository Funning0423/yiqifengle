'use strict';
// UI设计部 b16 修复（P1 小岛木牌 / P2 天空城夜间补光 / P2 L13 规则弹窗）的纯逻辑 + 源码检查。node tools/ui-b16-fixes/test_b16_ui_fixes.cjs
const fs=require('fs'),path=require('path'),assert=require('assert'),{load,SRC,typescript}=require('../t9-island-props/load_ts.cjs');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('PASS '+name);};
const src=f=>fs.readFileSync(path.join(SRC,f),'utf8');
ok('changed sources transpile without syntax errors',()=>{const ts=typescript();for(const f of ['WorldIntegrationBoot.ts','world-r2/IslandProps.ts','world-r2/IslandPropsLayout.ts','world-r2/WorldNavigationLayout.ts','ui/BoardLayout.ts','region/SkycityBoardLive.ts','region/RegionBoardNight.ts','region/SkycityCloudsea.ts','WarmButton.ts','ManagedMobileBoardUI.ts']){const r=ts.transpileModule(src(f),{reportDiagnostics:true,compilerOptions:{experimentalDecorators:true}});assert.equal((r.diagnostics||[]).length,0,f);}});
ok('P1 setSignEntrance skips only when the node visibility already matches; reports whether it applied',()=>{const s=src('world-r2/IslandProps.ts');
 assert(/e === this\.entrance && risePx === 0 && sign\.active === e > 0\) return true;/.test(s));assert(/setSignEntrance\(e: number, risePx = 0\): boolean/.test(s));assert(/signVisible\(\): boolean/.test(s));});
ok('P1 host: no invisible hit area once the entrance is over; one replay, then the visible flat 继续旅程 button while the 3D sign keeps retrying (1 s)',()=>{const s=src('WorldIntegrationBoot.ts');
 assert(/if\(ok!==false\)this\.signShown=e;/.test(s));assert(/if\(this\.signRetry<1\)\{this\.signRetry\+\+;this\.signShown=0;this\.signEntrance=0;\}/.test(s));
 assert(/now-this\.signRetryAt>=1000\)\{this\.signRetryAt=now;this\.signRetry\+\+;this\.setSign\(1,0\);\}if\(!\(p as any\)\.signVisible\(\)\)sign=null;/.test(s),'fallback keeps retrying the 3D sign every 1 s');
 assert(/else\{this\.setSign\(0,0\);this\.signEntrance=0;this\.signFadeS=\.2;/.test(s)&&/this\.signFadeS>0\?Math\.max\(0,Math\.min\(dt,\.1\)\)\/this\.signFadeS:step/.test(s),'retry success: sign reset to 0 on the same frame, then flat button -> 3D sign with a 0.2 s fade-in');
 assert(/if\(s\.state!=='island'\)this\.signRetry=0;/.test(s),'retry budget resets off the island');});
ok('P1 hit area min 88 logical px (>= 44pt); per-viewport inset checks live in t9-island-props test',()=>{const M=load();const L=M.IslandPropsLayout;assert(L.SIGN_HIT_MIN>=44);});
ok('P2 sky-city key light: day unchanged, night = world lightScale 0.35 and moon colour 180/198/232, monotonic blend',()=>{const M=load(['region/RegionBoardNight']).RegionBoardNight;
 const d=M.regionBoardKeyLight([255,243,218],12,0),nt=M.regionBoardKeyLight([255,243,218],12,1),h=M.regionBoardKeyLight([255,243,218],12,.5);
 assert.deepEqual(d.color,[255,243,218]);assert.equal(d.luminance,12);assert.deepEqual(nt.color,[180,189,198]);assert(Math.abs(nt.luminance-4.2)<1e-9);assert(h.luminance<12&&h.luminance>4.2);
 assert(/regionBoardKeyLight\(keyDay\.color,keyDay\.luminance,lightW\)|gradeSkycityKeyLight\(key,lightW\)/.test(src('region/SkycityBoardLive.ts')));/* cand-b18-stage5: night-r3 owns the key light, driven by b16 lightW */});
ok('P2 L13 rule guide: body left-aligned in a 480 box (100 each side inside the 680 frame), lines estimated per paragraph at 472',()=>{const s=src('ManagedMobileBoardUI.ts');
 assert(/const RULE_BODY_W = 480;/.test(s));assert(/p\.text\(body, -RULE_BODY_W \/ 2, [^;]*align: 'left'/.test(s));assert(!/width: 580, lines/.test(s));});
ok('L13 rule guide clears the HUD plate (+12 pt, title plank included) and the bottom safe area on 320×568 / 375×667 / 390×844, 1–9 lines',()=>{const B=load(['ui/BoardLayout']).BoardLayout;
 for(const [w,h] of [[320,568],[360,780],[375,667],[390,844]]){const safe=B.boardSafeInsets(w,h),g=B.boardLayout(w,h,safe,2),pb=g.plate.y+g.plate.height/2,k=Math.max(0.3,Math.min(w/750,h/1300,0.62));
  for(let lines=1;lines<=B.RULE_GUIDE_MAX_LINES;lines++){const ph=104+48+40+lines*40+48+104+72,dy=B.ruleGuideDy(w,h,ph,pb,safe.bottom,k)*k,top=h/2-ph*k/2-52.5*k+dy,bot=h/2+ph*k/2+dy;
   assert(top>=pb+12-1e-6,`top ${top.toFixed(1)} vs plate ${pb} @${w}x${h} lines ${lines}`);assert(bot<=h-safe.bottom-12+1e-6,`bottom ${bot.toFixed(1)} @${w}x${h} lines ${lines}`);}}
 assert(/dy: ruleGuideDy\(vw, vh, ph, plateBottom, [^)]*, popupScale\(vw, vh\)\)/.test(src('ManagedMobileBoardUI.ts')),'uses PopupKit.popupScale');assert(B.RULE_GUIDE_MAX_LINES===8);
 assert(!/Math\.min\(width \/ 750/.test(src('ui/BoardLayout.ts').slice(src('ui/BoardLayout.ts').indexOf('export function ruleGuideDy'))),'no copied popupScale formula');
 // every rule-guide text (rule + tool) fits in 8 lines at the 472 px estimate (PopupKit.measure: CJK = font size)
 const g=src('regional-r05/runtime/rule-guide.js'),meas=t=>[...t].reduce((w,c)=>w+(c.charCodeAt(0)>0x2e80?28:c===' '?28*.3:28*.56),0);
 const re=/(\w+):\{title:'[^']*',goal:'[^']*',rule:'([^']*)',tool:'([^']*)'\}/g;let m,cnt=0;while((m=re.exec(g))){cnt++;const lines=[m[2],m[3]].reduce((n,t)=>n+Math.max(1,Math.ceil(meas(t)/472)),0);assert(lines<=8,m[1]+' rule needs '+lines+' lines');}
 assert(cnt>=4,'rule texts found '+cnt);});
// ---------- b16 真机复核（ui-audit/2026-10-22/ui-b16-fixes-d58c1012-runtime）----------
ok('runtime ① mainline debounce: one accepted tap locks 1.2 s; off the island (level loading / board / transit) the lock keeps renewing; busy blocks',()=>{const N=load(['world-r2/WorldNavigationLayout']).WorldNavigationLayout;
 let lock=0,t=10000,fired=0;const tap=(busy=false)=>{if(N.mainlineTapAllowed(t,lock,busy)){lock=N.mainlineLockAfterTap(t);fired++;}};
 tap();t+=59;tap();t+=120;tap();assert.equal(fired,1,'rapid taps during the entrance fire once');
 for(const st of ['region-travel','board','board','island']){t+=400;lock=N.mainlineLockForState(lock,st,t);tap();}
 assert.equal(fired,1,'no second enter while loading/in the board, nor in the first 500 ms back on the island');
 t+=N.MAINLINE_RETURN_LOCK_MS+1;tap();assert.equal(fired,2,'normal tap works again');t+=5000;tap(true);assert.equal(fired,2,'busy blocks');
 const s=src('WorldIntegrationBoot.ts');assert(/if\(id==='mainline'\)\{const now=Date\.now\(\);if\(!mainlineTapAllowed\(now,this\.mainlineLock,this\.busy\)\)return false;this\.mainlineLock=mainlineLockAfterTap\(now\);\}/.test(s),'touch path');
 assert(/this\.resultActions\[id\]=\(\)=>\{if\(blocked\(\)\)return;if\(id==='mainline'\)\{const now=Date\.now\(\);if\(!mainlineTapAllowed/.test(s),'result-action path');
 assert(/this\.mainlineLock=mainlineLockForState\(this\.mainlineLock,s\.state,Date\.now\(\)\);/.test(s),'lock renewed every frame from the state');});
ok('runtime ② sky-city night: ambient x0.3 and main light x0.6 with the key light, one shared 0.6 s fade (no one-frame jump), restored on hide/dispose',()=>{const M=load(['region/RegionBoardNight']).RegionBoardNight;
 assert.deepEqual(M.regionBoardSceneLightScale(0),{ambient:1,main:1});const n=M.regionBoardSceneLightScale(1);assert(Math.abs(n.ambient-.3)<1e-9&&Math.abs(n.main-.6)<1e-9);
 let w=0,frames=0,maxStep=0;while(w<1&&frames<1000){const nw=M.easeRegionBoardLight(w,1,1/60);maxStep=Math.max(maxStep,nw-w);w=nw;frames++;}
 assert(frames>=30&&frames<=40,'day->night takes ~0.6 s at 60 fps, got '+frames+' frames');assert(maxStep<=1/36+1e-9,'per-frame step '+maxStep);
 assert.equal(M.easeRegionBoardLight(.5,0,5),.5-.1/.6,'dt clamped to 0.1 s');assert.equal(M.easeRegionBoardLight(NaN,1,0),1,'first frame snaps');
 const s=src('region/SkycityBoardLive.ts');assert(/if\(!shown\|\|snapNext\|\|!Number\.isFinite\(lightW\)\)\{lightW=skyNightBlend;/.test(s)&&/lightW=smoothRegionBoardLight\(fade\.from,skyNightBlend,fade\.p\)/.test(s));assert(/regionBoardSceneLightScale\(lightW\)/.test(s));
 assert(/if\(!shown\)\{restoreScene\(\);return;\}/.test(s)&&/dispose:\(\)=>\{if\(!dead\)\{dead=true;offNight\(\);(?:director\.off\(REGION_BOARD_TICK_EVENT,tick\);)?restoreScene\(\);\}/.test(s),'restored on hide and dispose');
 assert(/sc\.amb\.skyIllum!==sc\.ambWritten\)\{sc\.ambPrev=[^;]*;sc\.ambBase=sc\.amb\.skyIllum;/.test(s)&&/m\.illuminance!==sc\.mainWritten\)\{sc\.mainPrev=[^;]*;sc\.mainBase=m\.illuminance;/.test(s),'re-bases when the world rewrites the light (复核4: blended from the previous value)');
 assert(!/clearCameras|\bSkycityCloudsea\b/.test(s),'does not touch the city cameras baa28c06 clears');});
ok('runtime ③ island fallback 继续旅程 uses the 主页 WarmButton look (no journey primary leaf skin); region rows keep the journey skin',()=>{const s=src('WorldIntegrationBoot.ts');
 assert(/const skin=n\.name==='mainline'&&islandFallback\?'home':'journey';/.test(s));assert(/if\(skin==='journey'&&n\.name==='mainline'\)applyJourneyNavigationSkin\(n,'primary',r\.width,r\.height\);else if\(skin==='home'\)/.test(s));
 assert(/this\.placeNavigationControl\(this\.controls\.get\(id\)!,navigation\.buttons\[id\],id==='mainline'&&s\.state==='island'\)/.test(s)&&/islandNav\.buttons\[id\],id==='mainline'\)/.test(s));
 assert(/this\.placeNavigationControl\(n,navigation\.region\[id\]\)/.test(s),'region row unchanged');});
ok('runtime ④ signpost: >= 12 pt (+10 pt measured art slack) from the right edge, hit rect on screen (12 pt right inset) and >= 44 pt on 7 portrait sizes',()=>{const M=load(['world-r1/CameraPose','world-r1/RegionCameraData','world-r2/IslandPropsLayout']),C=M.CameraPose,L=M.IslandPropsLayout;
 const pose=C.fromLookAt(M.RegionCameraData.islandPoseEntry());assert.equal(L.SIGN_EDGE_PT,12);
 for(const [w,h] of [[320,568],[360,780],[375,667],[390,844],[402,874],[414,896],[430,932]]){const dx=L.signpostShiftX(pose,w,h),v=L.signpostRectUi(pose,w,h,dx),r=L.signpostHitUi(pose,w,h);
  assert(dx<=0&&dx>-1,'shift '+dx+' @'+w);assert(w/2-(v.x+v.width/2)>=L.SIGN_EDGE_PT+L.SIGN_BOX_SLACK_PT-0.5,'sign right gap @'+w+'x'+h);
  assert(r.x+r.width/2<=w/2-L.SIGN_EDGE_PT+1e-6&&r.x-r.width/2>=-w/2,'hit on screen @'+w+'x'+h);assert(r.width>=44&&r.height>=44,'hit >= 44 @'+w+'x'+h);}
 const s=src('world-r2/IslandProps.ts');assert(/sign\.setPosition\(S\.position\[0\] \+ this\.shiftX,/.test(s)&&/signpostHitUi\(pose, width, height, this\.shiftX\)/.test(s)&&/for \(const n of \[this\.sign, \.\.\.this\.waterNodes, this\.glow\?\.node\]\)/.test(s),'sign, water and lamp glow move together');});
ok('runtime ⑤ L13 rule guide: title plank >= 12 pt below the plate art (+7 pt overhang) on 320×568 / 375×667; kinsoku: no line starts with a closing mark',()=>{const B=load(['ui/BoardLayout']).BoardLayout;
 for(const [w,h] of [[320,568],[375,667]]){const safe=B.boardSafeInsets(w,h),g=B.boardLayout(w,h,safe,2),pb=g.plate.y+g.plate.height/2,k=Math.max(0.3,Math.min(w/750,h/1300,0.62));
  for(let lines=1;lines<=8;lines++){const ph=104+48+40+lines*40+48+104+72,dy=B.ruleGuideDy(w,h,ph,pb,safe.bottom,k)*k,top=h/2-ph*k/2-52.5*k+dy;assert(top-(pb+B.RULE_GUIDE_PLATE_OVERHANG)>=12-1e-6,`gap ${(top-pb).toFixed(1)} @${w}x${h} ${lines}`);}}
 const meas=t=>[...t].reduce((w,c)=>w+(c.charCodeAt(0)>0x2e80?28:c===' '?28*.3:28*.56),0),NS=B.KINSOKU_NO_START,NE=B.KINSOKU_NO_END;
 const L13='在风铃格本格或上下左右相邻格发生消除，风铃响一次；同一波（含特殊爆炸）最多响一次，响满所需次数完成。横向特殊扫过整行时，该行风铃各响一次。\n本地区暂无道具。';
 const g=src('regional-r05/runtime/rule-guide.js'),re=/rule:'([^']*)',tool:'([^']*)'/g;let m,texts=[L13,'一二三四五六七八九十一二三四五六）七八','一二三四五六七八九十一二三四五（六七八'];while((m=re.exec(g)))texts.push(m[1]+'\n'+m[2]);
 for(const t of texts){const ls=B.wrapKinsoku(t,472,meas);assert.equal(ls.join(''),t.replace(/\n/g,''),'no text lost');
  for(const l of ls){assert(meas(l)<=472+1e-6,'fits '+l);assert(!l||!NS.includes(l[0]),'line starts with '+l[0]+': '+l);}
  for(const l of ls.slice(0,-1))assert(!NE.includes(l[l.length-1])||t.split('\n').some(p=>p.endsWith(l)),'line ends with an opening bracket: '+l);}
 assert(/const wrapped = wrapKinsoku\(/.test(src('ManagedMobileBoardUI.ts')));});
ok('r6 lakeside previews pass measure_visible.py gates (day L13/L16, night L13/L16; exit 0)',()=>{const cp=require('child_process'),ROOT=path.resolve(__dirname,'..','..'),d=path.join(ROOT,'docs/r6/ui');
 const r=cp.spawnSync('python3',[path.join(d,'tools/measure_visible.py'),...['board_L13_390x844.png','board_L16_390x844.png','board_L13_night_390x844.png','board_L16_night_390x844.png'].map(f=>path.join(d,f))],{encoding:'utf8'});
 if(r.error&&r.error.code==='ENOENT'){console.log('  (python3 missing: skipped)');return;}assert.equal(r.status,0,r.stdout+r.stderr);});
// ---------- b16 复核2（ui-audit/2026-10-25/build16-fixes，c389259e）----------
ok('复核2 ④ sign mode: hit root right edge >= 22 pt, >= 44 pt, children laid out from the root size and never outside it (7 sizes)',()=>{const M=load(['world-r1/CameraPose','world-r1/RegionCameraData','world-r2/IslandPropsLayout','world-r2/WorldNavigationLayout']),C=M.CameraPose,L=M.IslandPropsLayout,N=M.WorldNavigationLayout;
 const pose=C.fromLookAt(M.RegionCameraData.islandPoseEntry());assert.equal(L.SIGN_HIT_EDGE_PT,22);
 for(const [w,h] of [[320,568],[360,780],[375,667],[390,844],[402,874],[414,896],[430,932]]){const r=L.signpostHitUi(pose,w,h),c=N.signChildLayout(r.width,r.height),right=r.x+r.width/2;
  assert(w/2-right>=22-1e-6,'root right gap '+(w/2-right).toFixed(1)+' @'+w);assert(r.width>=44&&r.height>=44,'hit >= 44 @'+w);
  for(const k of ['surface','label']){assert(c[k].width<=r.width+1e-9&&c[k].height<=r.height+1e-9,k+' inside root @'+w);assert(w/2-(r.x+c[k].width/2)>=22-1e-6,k+' right gap @'+w);}}
 const s=fs.readFileSync(path.join(SRC,'WorldIntegrationBoot.ts'),'utf8');
 assert(/\|\|\(m as any\)\.__qfSkin!=='sign'\)this\.layoutSignControl\(m,sign\.width,sign\.height\)/.test(s),'sign branch relayouts children');
 assert(/private layoutSignControl\(m:Node,w:number,h:number\)\{\(m as any\)\.__qfSkin='sign';const L=signChildLayout\(w,h\);[^\n]*configure\(L\.surface\.width,L\.surface\.height\)/.test(s));
 assert(/for\(const id of ISLAND_NAV_IDS\)\{const n=this\.controls\.get\(id\);if\(n\)if\(!\(id==='mainline'&&this\.propSign\)\)this\.placeNavigationControl/.test(s),'resize() no longer rebuilds the sign control at 250');});
ok('复核2 ② sky-city night board entry: clear colour + key/ambient/main lights share one 0.6 s fade from the show frame; no 100 ms window takes > 30% of the drop',()=>{const M=load(['region/RegionBoardNight']).RegionBoardNight;
 const day=[156,202,223],lum=w=>{const c=M.regionBoardClear(day,w),s=M.regionBoardSceneLightScale(w),k=M.regionBoardKeyLight([255,243,218],12,w);return (0.2126*c[0]+0.7152*c[1]+0.0722*c[2])*0.4+100*(s.ambient*0.4+s.main*0.3+k.luminance/12*0.3)*0.6;};
 for(const fps of [60,30,10,7]){let w=0,t=0;const pts=[[0,lum(0)]];while(w<1){w=M.easeRegionBoardLight(w,1,1/fps);t+=1/fps;pts.push([t,lum(w)]);}
  const total=pts[0][1]-pts[pts.length-1][1];assert(total>0);for(const [t0,l0] of pts){const after=pts.filter(p=>p[0]<=t0+0.1+1e-9).pop();assert((l0-after[1])/total<=0.3+1e-9,`drop ${(100*(l0-after[1])/total).toFixed(0)}% in 100 ms @${fps}fps t=${t0.toFixed(2)}`);}
  if(fps>=10)assert(t>=0.55&&t<=0.75,'fade ~0.6 s, got '+t.toFixed(2)+' @'+fps);}
 const s=fs.readFileSync(path.join(SRC,'region/SkycityBoardLive.ts'),'utf8');
 assert(/writeRegionBoardClear\(camera,SKYCITY_BOARD_DAY_CLEAR,lightW,/.test(s),'clear colour follows lightW');assert(!/writeRegionBoardClear\(camera,SKYCITY_BOARD_DAY_CLEAR,skyNightBlend/.test(s),'no instant clear write');
 assert(/if\(v&&!shown\)\{snapNext=true;lastT=0;\}/.test(s)&&!/lightW=0;/.test(s),'复核3: show snaps to the current target (night entry = night first frame)');});
ok('复核3 ② on-board day/night toggle: smoothstep over 0.6 s by real dt, any 100 ms <= 30% of the drop, ends exactly on the night target; ticked every frame by the director',()=>{const M=load(['region/RegionBoardNight']).RegionBoardNight;
 const day=[156,202,223],lum=w=>{const c=M.regionBoardClear(day,w),s=M.regionBoardSceneLightScale(w),k=M.regionBoardKeyLight([255,243,218],12,w);return (0.2126*c[0]+0.7152*c[1]+0.0722*c[2])*0.4+100*(s.ambient*0.4+s.main*0.3+k.luminance/12*0.3)*0.6;};
 for(const fps of [120,60,30,10]){let p=0,t=0;const pts=[[0,lum(0)]];while(p<1){p=Math.min(1,p+Math.min(1/fps,.1)/M.REGION_BOARD_LIGHT_FADE_S);t+=1/fps;pts.push([t,lum(M.smoothRegionBoardLight(0,1,p))]);}
  const total=pts[0][1]-pts[pts.length-1][1];assert(Math.abs(pts[pts.length-1][1]-lum(1))<1e-9,'ends on night value');
  for(const [t0,l0] of pts){const after=pts.filter(q=>q[0]<=t0+0.1+1e-9).pop();assert((l0-after[1])/total<=0.3+1e-9,`drop ${(100*(l0-after[1])/total).toFixed(0)}% @${fps}fps`);}}
 const s=fs.readFileSync(path.join(SRC,'region/SkycityBoardLive.ts'),'utf8');assert(/director\.on\(REGION_BOARD_TICK_EVENT,tick\)/.test(s)&&/director\.off\(REGION_BOARD_TICK_EVENT,tick\)/.test(s));assert.equal(M.REGION_BOARD_TICK_EVENT,'director_after_update');});
ok('复核3 ④ sign tap root: WarmButtonFace follows configure() (was fixed at 240) and no child is wider than the root; root on screen, >= 44 pt, right >= 22 pt on 7 sizes',()=>{const M=load(['world-r1/CameraPose','world-r1/RegionCameraData','world-r2/IslandPropsLayout']),L=M.IslandPropsLayout,pose=M.CameraPose.fromLookAt(M.RegionCameraData.islandPoseEntry());
 for(const [w,h] of [[320,568],[360,780],[375,667],[390,844],[402,874],[414,896],[430,932]]){const r=L.signpostHitUi(pose,w,h);assert(r.width<240,'root not fixed 240 @'+w);
  assert(r.x-r.width/2>=-w/2&&r.x+r.width/2<=w/2-L.SIGN_HIT_EDGE_PT+1e-6&&r.y-r.height/2>=-h/2&&r.y+r.height/2<=h/2,'root on screen @'+w);assert(r.width>=44&&r.height>=44);}
 const wb=src('WarmButton.ts');assert(/else this\.face\.getComponent\(UITransform\)\?\.setContentSize\(width,height\);/.test(wb),'face resized on every configure');
 const b=src('WorldIntegrationBoot.ts');assert(/for\(const t of m\.getComponentsInChildren\(UITransform\)\)if\(t\.node!==m&&\(t\.width>L\.surface\.width\|\|t\.height>L\.surface\.height\)\)/.test(b),'children clamped to root');});
ok('复核4 ② world steps blended on the board: Cloudsea skips the board camera; main light/colour/ambient interpolate prev→world by the board smoothstep',()=>{const s=src('region/SkycityBoardLive.ts');
 assert(/\(camera as any\)\.__qfBoardClearOwner=true/.test(s)&&/&&!\(camera as any\)\.__qfBoardClearOwner/.test(src('region/SkycityCloudsea.ts')));
 assert(/const mix=fade\?smoothRegionBoardLight\(0,1,fade\.p\):1/.test(s)&&/\(sc\.mainPrev\+\(sc\.mainBase-sc\.mainPrev\)\*mix\)\*f\.main/.test(s)&&/\(sc\.ambPrev\+\(sc\.ambBase-sc\.ambPrev\)\*mix\)\*f\.ambient/.test(s)&&/lerpRgb\(sc\.colPrev,sc\.col,mix\)/.test(s));});
console.log(n+' checks passed');
