"""Call only the existing verified game window through the official background CLI."""
from pathlib import Path
import json,re,subprocess,sys
root=Path(__file__).resolve().parents[1]
e=root/'evidence/fb338ef-integration-20261010'
label,kind=sys.argv[1:3]
assert re.fullmatch(r'[a-z0-9-]+',label)
project=Path('/var/folders/mj/mrt0w4m97fb6xs3g4rsj5b8w0000gn/T/qf-first-open/QFFirstOpen-20261010T084620701Z-adad-e429da-default')
c=json.loads((project/'project.config.json').read_text());assert c['appid']=='wx3bdd911c5c06f591' and c['projectname']==project.name
args=['/tmp/oi-readonly-runtime-cli',str(e/label),'-c','codex']
if kind=='probe':
 fn="() => ({appId:wx.getAccountInfoSync().miniProgram.appId,diagnostics:wx.getStorageSync('dot-runtime-diagnostics-20261010:world-flow')||null,sky:wx.getStorageSync('dot-runtime-diagnostics-20261010:skycity')||null})"
 args+=['automation_evaluate','--project',str(project),'--fn-source',fn]
elif kind=='shot':args+=['simulator_screenshot','--project',str(project),'--path',str(e/(label+'.jpg'))]
elif kind=='tap':
 x,y=map(float,sys.argv[3:5]);assert 0<=x<=586 and 0<=y<=1266
 args+=['automation_game_action','--project',str(project),'--action','tap','--x',str(x),'--y',str(y),'--coordinate-space','image','--image-width','586','--image-height','1266']
else:raise ValueError(kind)
subprocess.run(args,check=True)
