import json,subprocess,sys,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
P=str(ROOT/'native-package')
identity=json.loads((ROOT/'evidence/isolation-identity.json').read_text())
args=sys.argv[1:]; label=args.pop(0); tool=args.pop(0)
if tool=='command':
 tool='automation_evaluate'
 command=json.loads(args.pop(0))
 fn='function(){wx.setStorageSync('+json.dumps(identity['prefix']+'__test_control')+','+json.dumps(json.dumps(command))+');return {queued:true};}'
 args=['--fn-source',fn]
elif tool=='observe':
 tool='automation_evaluate'
 fn='function(){const s=wx.getStorageSync('+json.dumps(identity['prefix']+'__test_observation')+'); if(!s)return {observer:"not-ready"}; const d=JSON.parse(s); const a=d.audit||[];d.audit={count:a.length,keys:Array.from(new Set(a.map(x=>x.key))),allKeysWithinPrefix:a.every(x=>x.key.startsWith(d.prefix)),operations:Array.from(new Set(a.map(x=>x.op)))}; if(d.mainline)d.mainline={state:d.mainline.state,active:d.mainline.active,readOnly:d.mainline.readOnly,error:d.mainline.error,nextStageId:d.mainline.nextStageId};if(d.board){const b=d.board,q=b.snapshot;d.board={checkpoint:b.checkpoint,layout:b.layout,inputGate:b.inputGate,presentationError:b.presentationError,hints:b.hints,hintCells:b.hintCells,snapshot:{state:q.state,active:q.active,hidden:q.hidden,readOnly:q.readOnly,error:q.error,visual:q.visual},storage:b.storage};}return JSON.stringify(d);}'
 args=['--fn-source',fn]
cmd=['wechatide','-c','codex-board-test',tool,'--project',P]+args
r=subprocess.run(cmd,text=True,capture_output=True,timeout=60)
(ROOT/'evidence'/f'{label}.json').write_text(r.stdout)
(ROOT/'evidence'/f'{label}.stderr.txt').write_text(r.stderr)
if r.returncode: print(r.stdout,r.stderr);sys.exit(r.returncode)
try:
 x=json.loads(r.stdout);result=x.get('result',{})
 if tool=='automation_evaluate':
  data=result.get('result',{});data=json.loads(data) if isinstance(data,str) else data;(ROOT/'evidence'/f'{label}-state.json').write_text(json.dumps(data,ensure_ascii=False,indent=2));print(json.dumps({'ok':x.get('ok'),'prefix':data.get('prefix'),'world':data.get('world'),'boardState':((data.get('board') or {}).get('snapshot') or {}).get('state'),'mainlineState':(data.get('mainline') or {}).get('state'),'observer':data.get('observer')},ensure_ascii=False)[:6500])
 else: print(r.stdout)
except json.JSONDecodeError as e:print('CLI JSON result truncated or malformed:',str(e),'bytes=',len(r.stdout))
