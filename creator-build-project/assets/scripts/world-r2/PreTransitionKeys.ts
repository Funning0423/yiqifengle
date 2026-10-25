/** Test-only pre-transition entry (`__qfPreTransition(key)` / `?qfPre=<key>`) for 全流程测试部. Engine-independent (no 'cc'),
 *  unit-tested in Node. It only SETS UP real game state (isolated test profile + real world moves) and stops just before a
 *  scene transition; the tester then fires the transition with a normal touch on the named trigger, so the whole transition
 *  plays through the normal code path. Same host gate as __qfTeleport (qaHooksEnabled): web/QA build, WeChat develop/trial;
 *  never WeChat release. In WeChat the URL query comes from the launch options (DevTools 编译模式 启动参数). */
import { qaSkipAllowed, qaSkipTarget, qaQuery, qaHarnessEnabled } from './QaSkip';
export type PreKey='home-island'|'island-home'|'island-board'|'node-walk'|'board-exit-island'|'island-meadow'|'meadow-skycity'|'skycity-finale'|'skycity-lakeside'|'lakeside-exit'|'lakeside-home'|'skycity-visit'|'skycity-visit-exit'|'lake-13-14'|'lake-14-15'|'lake-15-16'|'lake-16-17'|'lake-17-18'|'lake-18-home'|'lake-fail'|'ending';
export type PreTap={kind:'node';path:string[]}|{kind:'control';id:string}|{kind:'glass-sign'}|{kind:'lighthouse'};
export type PreSpec={key:PreKey;label:string;checkpoint:number|null;finish:boolean;place:'home'|'island'|'result'|'skycity'|'lake-board'|'lakeside'|'skycity-visit'|'lake-result';stage?:string;lakeMode?:'win'|'lose';
 trigger:string;taps:PreTap[];expect:string};
const N=(...path:string[]):PreTap=>({kind:'node',path});
export const PRE_SPECS:readonly PreSpec[]=[
 {key:'home-island',label:'出门：屋内 → 小岛',checkpoint:null,finish:false,place:'home',trigger:'点屋里的玻璃招牌（或门把手）',taps:[{kind:'glass-sign'}],expect:'起身→转身→走到门口→推门→走出→镜头升起落到小岛（state home→standing…→island）'},
 {key:'island-home',label:'回屋：小岛 → 屋内',checkpoint:null,finish:false,place:'island',trigger:'点小岛上的灯塔',taps:[{kind:'lighthouse'}],expect:'走回屋→关门→走到座位坐下（state island→walking-home…→home）'},
 {key:'island-board',label:'进关：小岛 → 主线 04 棋盘',checkpoint:4,finish:false,place:'island',trigger:'点「继续旅程 →」（路牌/按钮）',taps:[{kind:'control',id:'mainline'}],expect:'进关推镜→棋盘淡入（state island→level-loading→level，mainline-04）'},
 {key:'node-walk',label:'关间走路：主线 02 → 03（小岛内）',checkpoint:2,finish:false,place:'result',stage:'mainline-02',trigger:'结算面板「下一关」',taps:[N('ResultPanel','Next')],expect:'领取宝箱→她走到下一个节点→主线 03 棋盘推入'},
 {key:'board-exit-island',label:'出关：主线 02 结算 → 小岛自由探索',checkpoint:2,finish:false,place:'result',stage:'mainline-02',trigger:'结算面板「回小岛」',taps:[N('ResultPanel','Home')],expect:'领取奖励→棋盘退出→小岛自由探索（state level→island）'},
 {key:'island-meadow',label:'帆船：小岛 → 风车草原（04→05）',checkpoint:4,finish:false,place:'result',stage:'mainline-04',trigger:'结算面板「下一关」',taps:[N('ResultPanel','Next')],expect:'领取→走到码头→帆船航行（region-loading→region-travel）→草原落地→主线 05 棋盘'},
 {key:'meadow-skycity',label:'热气球：草原 → 天空城（08→09）',checkpoint:8,finish:false,place:'result',stage:'mainline-08',trigger:'结算面板「下一关」',taps:[N('ResultPanel','Next')],expect:'领取→热气球升空飞行→天空城落地→主线 09 棋盘'},
 {key:'skycity-finale',label:'天空城终章：主线 12 地区奖励',checkpoint:12,finish:false,place:'result',stage:'mainline-12',trigger:'结算面板宝箱（领取地区奖励）',taps:[N('ResultPanel','ResultChestTap')],expect:'领取地区奖励→她离开台阶顶，抬头看星环（playFinale）→自由探索'},
 {key:'skycity-lakeside',label:'热气球：天空城 → 风铃湖畔（L13 入场）',checkpoint:12,finish:true,place:'skycity',trigger:'点「继续旅程 →」',taps:[{kind:'control',id:'mainline'}],expect:'热气球飞往湖畔→推开篮门走上岸→湖畔棋盘 r04-lake-01（L13）淡入'},
 {key:'lakeside-exit',label:'湖畔出关：L13 棋盘 → 湖畔自由探索',checkpoint:12,finish:true,place:'lake-board',trigger:'棋盘左上「暂停」→ 暂停面板「离开棋盘」',taps:[N('pause'),N('PausePanel','Home')],expect:'棋盘退出→湖畔自由探索（state level→lakeside）'},
 {key:'lakeside-home',label:'湖畔回家：湖畔 → 屋内',checkpoint:12,finish:true,place:'lakeside',trigger:'点「主页」',taps:[{kind:'control',id:'home'}],expect:'整屏淡出→屋内坐下→淡入（leaveJourneyForIsland，state lakeside→home）'},
 {key:'skycity-visit',label:'参观天空城：小岛日志 → 天空城 3D',checkpoint:12,finish:true,place:'island',trigger:'已打开的「天空」章节面板里点「前往天空城 · 3D 场景」',taps:[N('ChapterPanel','VisitSkycity')],expect:'skycity-loading→天空城 3D 场景（state island→skycity）'},
 {key:'skycity-visit-exit',label:'参观结束：天空城 3D → 小岛',checkpoint:12,finish:true,place:'skycity-visit',trigger:'点「返回小岛」',taps:[{kind:'control',id:'returnIsland'}],expect:'天空城卸载→回到小岛（state skycity→island）'},
 /* b18 湖畔关间（场景设计部 win-replays.json；测试存档按顺序解锁把前面的湖畔关打通，进本关后停在最后一步之前） */
 {key:'lake-13-14',label:'湖畔关间：L13 → L14',checkpoint:12,finish:true,place:'lake-result',stage:'r04-lake-01',lakeMode:'win',trigger:'结算面板「下一关」',taps:[N('ResultPanel','Next')],expect:'棋盘退出→L14（r04-lake-02）棋盘进入（advanceRegistered）'},
 {key:'lake-14-15',label:'湖畔关间：L14 → L15',checkpoint:12,finish:true,place:'lake-result',stage:'r04-lake-02',lakeMode:'win',trigger:'结算面板「下一关」',taps:[N('ResultPanel','Next')],expect:'棋盘退出→L15（r04-lake-03）棋盘进入'},
 {key:'lake-15-16',label:'湖畔关间：L15 → L16',checkpoint:12,finish:true,place:'lake-result',stage:'r04-lake-03',lakeMode:'win',trigger:'结算面板「下一关」',taps:[N('ResultPanel','Next')],expect:'棋盘退出→L16（r04-lake-04）棋盘进入'},
 {key:'lake-16-17',label:'湖畔关间：L16 → L17（当前代码 L16 之后接 L17）',checkpoint:12,finish:true,place:'lake-result',stage:'r04-lake-04',lakeMode:'win',trigger:'结算面板「下一关」',taps:[N('ResultPanel','Next')],expect:'棋盘退出→L17（r04-lake-05）棋盘进入（结局接通后这里会改成 WindWipe→结局，届时另加 ending key）'},
 {key:'lake-17-18',label:'湖畔关间：L17 → L18「刻名的桥」',checkpoint:12,finish:true,place:'lake-result',stage:'r04-lake-05',lakeMode:'win',trigger:'结算面板「下一关」',taps:[N('ResultPanel','Next')],expect:'棋盘退出→L18 刻名的桥（r04-lake-06，需 L13–L15 已通关）棋盘进入'},
 {key:'lake-18-home',label:'湖畔收尾：L18 结算 → 离开棋盘',checkpoint:12,finish:true,place:'lake-result',stage:'r04-lake-06',lakeMode:'win',trigger:'结算面板「回小岛」（先自动领取地区印记）',taps:[N('ResultPanel','Home')],expect:'领取湖畔地区印记→棋盘退出→湖畔自由探索（state level→lakeside）'},
 {key:'lake-fail',label:'湖畔失败面板：L13 输 → 再试一次',checkpoint:12,finish:true,place:'lake-result',stage:'r04-lake-01',lakeMode:'lose',trigger:'失败面板「再试一次」（摆位后先看副标题 failHint）',taps:[N('ResultPanel','Replay')],expect:'失败面板副标题显示本关提示（≤14 字单行）；点「再试一次」→L13 重新开局'},
 {key:'ending',label:'结局：最后一关湖畔结算 → 结局（TR9）',checkpoint:12,finish:true,place:'lake-result',stage:'r04-lake-06',lakeMode:'win',trigger:'结算面板「继续」（ResultPanel/Next，endingAvailable 时文字为 继续）',taps:[N('ResultPanel','Next')],expect:'WindWipe（3D 风铃）盖屏→结局画面淡入（__qfEnding.shown=true）→点结局「回小岛」再走 WindWipe 回小岛'},
];
export const PRE_KEYS:readonly PreKey[]=PRE_SPECS.map(s=>s.key);
export function preSpec(key:string):PreSpec|null{return PRE_SPECS.find(s=>s.key===key)||null;}
/** Transitions that exist in the game but cannot be staged (reported in the list so nobody assumes coverage). */
export const PRE_UNSUPPORTED:readonly {key:string;reason:string}[]=[
];
/** WeChat has no location: read the DevTools launch query (编译模式 启动参数 qfHooks=1&qfPre=…) as a search string. */
export function preSearch(search?:string|null,host:any=globalThis):string{
 if(search!=null)return search;
 return qaQuery(host);/* location.search + enter/launch query merged (DevTools worker location.search is never empty) */
}
/** `?qfPre=<key>` (valid key only). Never in WeChat release. */
export function preTransitionKey(search?:string|null,host:any=globalThis):PreKey|null{
 const q=preSearch(search,host);const m=/(?:^|[?&])qfPre=([a-z-]+)(?:&|$)/.exec(q);
 if(!m||!(PRE_KEYS as readonly string[]).includes(m[1])||!qaSkipAllowed(host))return null;return m[1] as PreKey;
}
/** Hook registration gate: same as __qfTeleport (?qfSkip / ?qfHooks=1) plus a valid ?qfPre. Release: always false. */
export function preTransitionEnabled(search?:string|null,host:any=globalThis):boolean{
 if(!qaSkipAllowed(host))return false;if(search==null&&qaHarnessEnabled(host))return true;const q=preSearch(search,host);
 return qaSkipTarget(q,host)!==null||/(?:^|[?&])qfHooks=1(?:&|$)/.test(q)||preTransitionKey(q,host)!==null;/* = qaHooksEnabled (p0drag9), inlined so this also cherry-picks onto builds without it */
}
/** UI point helper (pure): a node centre in canvas-local px (y up, origin at canvas centre) -> top-left CSS px. */
export function canvasLocalToScreen(lx:number,ly:number,w:number,h:number){return {x:Math.round(w/2+lx),y:Math.round(h/2-ly)};}
