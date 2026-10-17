import json,subprocess,datetime,shutil
P='/workspace/handoff-prep/';H='/tmp/wt-handoff/handoff/'
t=open(P+'MASTER_TEMPLATE.md').read()
r41=subprocess.check_output(['git','-C','/workspace/wechat-game/yiqifengle','rev-parse','--short','integration/build05-r41-20261017T125738Z']).decode().strip()
d=json.load(open(P+'sel.json'))
rows=json.load(open(P+'branches.json'))
now=datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
rep={'@@GEN_TIME@@':now,'@@R41@@':r41,'@@NPUSH@@':str(sum(1 for r in rows if r[6]=='是' and r[0]!='handoff/20261017')),
 '@@LSR_TIME@@':now+' EDT','@@BRANCH_TABLE@@':open(P+'branches_table.md').read(),
 '@@SNAP_FILES@@':f"{len(d['inc']):,}",'@@SNAP_MB@@':f"{sum(s for _,s in d['inc'])/1e6:,.1f}",
 '@@EXCL_SUMMARY@@':open(P+'excl_summary.md').read(),'@@BIG@@':open(P+'big.md').read().rstrip()}
for k,v in rep.items(): t=t.replace(k,v)
open(H+'MASTER_HANDOFF.md','w').write(t)
shutil.copy(P+'branches.tsv',H+'BRANCHES.tsv')
open(H+'README.md','w').write("""# handoff/

- `MASTER_HANDOFF.md`：總交接文件（繁體中文），從這裡開始讀。
- `BRANCHES.tsv`：全部本機分支（完整 SHA、負責、狀態、是否已在 origin、是否推送）。
- `bots/`：各 bot 的 HANDOFF.md 副本與 m1v2 布料 PROBLEM_BRIEF。
- `EXCLUDED_FROM_SNAPSHOT.tsv`：沒有放進快照的檔案（路徑、大小、原因），它們仍在 box 的 `/workspace/wechat-game/` 原路徑。
- `workspace-snapshot/`：`/workspace/wechat-game/` 非 git 資料快照（product/、team/、ui-audit/、ui-design/ 等）。
- `tools/`：產生本交接包的腳本（選檔規則、分支表、密鑰掃描結果）。
""")
print('rendered',r41)
