import subprocess,re,json
R='/workspace/wechat-game/yiqifengle'
def g(*a): return subprocess.check_output(['git','-C',R]+list(a)).decode()
rem={}
for l in open('/tmp/hb_remote.txt'):
    s,r=l.split(); rem[r[11:]]=s
R4='2153a65'; R41=g('rev-parse','integration/build05-r41-20261017T125738Z').strip()
B05='09a1b8e'
def anc(s,t): return subprocess.call(['git','-C',R,'merge-base','--is-ancestor',s,t])==0
OWN={'ggbot':'GGbot','integration':'GGbot','handoff':'GGbot','fix':'GGbot','test':'GGbot','cine':'運鏡bot','cinematic':'運鏡bot','voice':'Voice Bot','voicebot':'Voice Bot','voice-bot':'Voice Bot','scene-design':'場景設計部','grok':'Grok Bot/Oi','oi':'Oi','mac':'Cursor CLI(Mac)','pr58-remote':'(舊 PR58)'}
ACC,WIP,UN,SUP,ARC='已驗收','進行中','未驗收','被取代','封存'
S={
# GGbot / integration
'integration/build05-r4-20261017T122042Z':(ACC,'r4 最終；內容已驗收，Mac 驗收進行中（界面驗收部）'),
'integration/build05-r41-20261017T125738Z':(WIP,'r4.1 集成線；含 74c696e(260ea02)/fd1a39d(0ea1564)/b1e41b2(cfe6429)/77883aa 切後台續走/e4a05b9(f125cd2)/77ef6ad 前景計時看門狗；待 Mac 驗收'),
'handoff/20261017':(WIP,'本交接分支（r4.1 77ef6ad + handoff/ 文件與快照）'),
'ggbot/build05-r42-fixes':(WIP,'剛建立（= r4.1 e4a05b9），尚無自己的提交'),
'ggbot/build05-r5-rainbow-bridge':(WIP,'彩虹橋引擎實作（基於 r4.1 fd1a39d），未做真機截圖'),
'ggbot/build05-r41-hint-above-tray':(ACC,'r4.1 提示牌移到托盤上方（Grok Bot 選項 1）；已進 r4.1 為 74c696e'),
'ggbot/build05-r4-dryrun3':(ACC,'r4 中間線（已併入 r4）'),
'ggbot/build05-r4-dryrun2':(ACC,'r4 中間線（已併入 r4）'),
'ggbot/build05-r4-dryrun':(SUP,'作廢，勿用'),
'ggbot/build05-r4-prep':(ACC,'已併入 r4'),
'ggbot/build05-r4-journey-fixes':(ACC,'已併入 r4'),
'ggbot/build05-r4-ui-fixes':(ACC,'50a3074 已驗收，併入 r4（為 02e7fd4 等）'),
'ggbot/build05-r4-skycity-figure':(ACC,'bfdcf19 園丁動畫接續，已驗收併入 r4'),
'ggbot/build05-r4-tests-reward':(ACC,'最終測試線，已併入 r4'),
'ggbot/build05-r4-tests':(ACC,'= voice/build05-r4-tests e79bfca，已併入 r4'),
'ggbot/build05-r4-rewardfix':(ACC,'測試線內容，已併入 r4'),
'ggbot/build05-day-clear-fix':(UN,'未見驗收記錄'),
'ggbot/build05-v3.2':(SUP,'被 v3.2-final 取代'),
'ggbot/d238881-oi-review':(UN,'Oi 審查分支'),
'ggbot/d238881-oi-review-fade':(UN,'Oi 審查分支'),
'ggbot/exit-audio-duck':(SUP,'舊出門音訊'),
'ggbot/pr56-exit-audio':(SUP,'舊出門音訊'),
'ggbot/result-screen':(SUP,'被 result-screen-on-688aad3 取代'),
'ggbot/result-screen-on-688aad3':(UN,'結算畫面；d6a0019 (=本分支~1, 設計 v2.2) 程式碼已併入 build05/r4，但設計待 Funning 最終選定、未做真機驗收'),
'ggbot/scratch-landing-A2':(ARC,'草稿'),
'ggbot/skycity-mesh-compress':(UN,'未見驗收記錄'),
'integration/build05-20261016T2048':(ACC,'= Funning 桌面包 build05 基線 09a1b8e（milestone 驗收通過）'),
'ggbot/audit-fixes-77b76c3':(ACC,'= 09a1b8e 桌面包基線'),
'integration/build05-a3b-20261017T063646Z':(ACC,'Mac a3b-a995c41 通過；主工作區所在分支；後續 r3/r4 線另行集成'),
'integration/build05-next-20261017T0818Z-r3':(SUP,'r3 Mac 驗收未過（lakemerge off DC71 等），由 r4 取代；為 r4 基底'),
'integration/build05-next-20261017T0818Z-r3-diag':(ARC,'r3 診斷'),
'integration/build05-next-20261017T0807Z-r3':(SUP,'r3 早期'),
'integration/build05-next-20261017T0725Z':(SUP,'next-r2 228df2f，已被取代'),
'integration/build05-next-20261017T0725Z-journey-merge':(SUP,''),
'integration/build05-next-20261017T0702Z':(SUP,''),
'integration/build05-next-20261017T0702Z-optional-water-dc':(SUP,''),
'integration/build05-next-20261017T0438':(SUP,'next-f60c8ec（Mac 除湖畔外通過）'),
'integration/build05-next-dirlight-20261017T0452':(SUP,''),
'integration/build05-next-lights-20261017T0445':(SUP,''),
'integration/build05-next-scenefix-20261017T0636':(SUP,''),
'integration/build05-next-scenefix-20261017T0636-scenefix-only':(SUP,''),
'fix/a3-home-sea-fadein':(ACC,'a3b-a17395c Mac 通過，已在 r4 歷史'),
'test/lake-gate-0':(ARC,'實驗'),
'pr58-remote':(ARC,'舊 PR58 遠端分支本地副本'),
'mac/task21-web-ui':(ARC,'舊 Mac task21（origin 已有）'),
'scene-design/export-fix':(UN,'區域導出修正 + 湖畔 r5h3 重新導出'),
'scene-design/bamboo-s2':(WIP,'竹排 S2 預留，尚無 S2 提交（同 b9f04f7）'),
# cine
'cine/region-hooks-meadow-skycity-r4':(ACC,'95d3eee（r4 採用，Mac 零跳變）'),
'cine/region-hooks-meadow-skycity-r4-head':(ACC,'5b1f41d girl-frame，已在 r4'),
'cine/night-glass-r4':(ACC,'9c8fb36，已在 r4；需 Mac 夜間照片'),
'cine/exit-cam-B5':(ACC,'Funning 10/16 定稿 B5.5'),
'cine/m1v2-src-apron-ease':(ACC,'508b87b 已驗收；023a47c 只改 PROBLEM_BRIEF；獨立歷史根（無共同祖先），單獨推送'),
'cine/lakeside-hook-v3-on-r3':(ACC,'已在 r4 歷史（patch 等價）'),
'cine/lakeside-enter-hold-r3':(ACC,'已在 r4 歷史（patch 等價）'),
'cine/region-hooks-meadow-r4.1-on-260ea02':(WIP,'已交付待合：0ea1564 草甸 r4.1 落點，已進 r4.1 為 fd1a39d；Mac GPU 切換複核待做'),
'cine/skycity-bridge-r2-cam':(WIP,'天空之城 B r2 鏡頭；尚無自己的提交（= r4.1 e4a05b9）'),
'cine/cinematic-handoff-20261017':(WIP,'運鏡bot HANDOFF 文件分支（含 ad05040、4bc614d）'),
'cine/region-hooks-meadow-r4-ggkeepout':(SUP,'2665429，r4 不用'),
'cine/region-hooks-meadow-r4.1':(SUP,'同 95d3eee 的舊名'),
'cinematic/window-tap-exit-proto':(ARC,'舊原型'),
}
for b in ['region-hooks-meadow-skycity','lakeside-cam','lakeside-hook-on-be1cd5a','lakeside-hook-on-r2','lakeside-hook-r2-v2','lakeside-hook-v2-on-journey-merge','lakeside-hook-v2-on-voice-r2','meadow-early-preload','meadow-early-preload-r2','meadow-early-preload-r2-f2adb78','sail-start-gate-r3','glass-v4r32','glass-v4r32-on-e2a03ec','pr56-r4-instantiate-split']:
    S['cine/'+b]=(SUP,'放棄/被取代（封存）')
# voice: parse HANDOFF table
vt={}
for l in open('/workspace/wechat-game/team/voice-bot/HANDOFF.md'):
    m=re.match(r'\| `(voice/[^`]+)` \| `([0-9a-f]{40})` \|[^|]*\|[^|]*\| ([^|]*)\|',l)
    if m: vt[m.group(1)]=m.group(3).strip()
for b,st in vt.items():
    if b in S: continue
    low=st.lower()
    if 'accepted' in low and 'not accepted' not in low: s=ACC
    elif low.startswith('merged'): s=ACC
    elif 'superseded' in low: s=SUP
    else: s=UN
    S[b]=(s,'Voice Bot: '+st[:140])
S['voice/build05-r4-exit-footsteps']=(ACC,'f125cd2（= r4.1 e4a05b9；父提交 cfe6429 已驗收）')
S['voice/audio-cc0-20261015']=(UN,'不推送：含 bgm_reference_NOT_FOR_SHIP 轉檔；留在 box')
NOPUSH={'voice/audio-cc0-20261015'}
rows=[]
for l in g('branch','--format=%(refname:short) %(objectname)').splitlines():
    b,s=l.split()
    pre=b.split('/')[0] if '/' in b else b
    if pre in('voicebot','voice-bot'):
        st,note=(ARC,'舊別名，不推送（voice/* 已有同 SHA 名稱）'); push='否'
    else:
        st,note=S.get(b,(None,''))
        if st is None:
            if anc(s,B05): st,note=ACC,'已併入 build05（09a1b8e）'
            elif anc(s,R4): st,note=ACC,'已在 r4 歷史'
            else: st,note=UN,'未見驗收記錄'
        push='否' if b in NOPUSH else '是'
    onor='是(相同)' if rem.get(b)==s else ('是(SHA 不同)' if b in rem else '否')
    rows.append((b,s[:7],s,OWN.get(pre,pre),st,onor,push,('r4' if anc(s,R4) else ('r4.1' if anc(s,R41) else '')),note))
json.dump(rows,open('/workspace/handoff-prep/branches.json','w'),ensure_ascii=False)
with open('/workspace/handoff-prep/pushlist.txt','w') as f:
    for r in rows:
        if r[6]=='是': f.write(r[0]+'\n')
md=['| 分支 | SHA | 負責 | 狀態 | 已在 origin | 推送 | 在 r4/r4.1 內 | 說明 |','|---|---|---|---|---|---|---|---|']
for r in rows: md.append(f'| `{r[0]}` | `{r[1]}` | {r[3]} | {r[4]} | {r[5]} | {r[6]} | {r[7]} | {r[8]} |')
open('/workspace/handoff-prep/branches_table.md','w').write('\n'.join(md)+'\n')
open('/workspace/handoff-prep/branches.tsv','w').write('branch\tsha\towner\tstatus\ton_origin\tpush\tin\tnote\n'+'\n'.join('\t'.join([r[0],r[2],r[3],r[4],r[5],r[6],r[7],r[8]]) for r in rows)+'\n')
import collections
print(len(rows),collections.Counter(r[4] for r in rows),collections.Counter(r[6] for r in rows))
for r in rows:
    if r[8] in('未見驗收記錄',): print('DEFAULT',r[0])
