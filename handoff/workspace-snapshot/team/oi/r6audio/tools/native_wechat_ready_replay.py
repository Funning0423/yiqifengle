"""Normal native game input; console use is READ ONLY in selected gameContext.
Requires the exact named test window and manually selected gameContext.
Never writes game storage or calls action/debug mutation functions.
"""
import json, subprocess, time, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence/wechat-r6-acceptance'
OUT.mkdir(parents=True, exist_ok=True)
QUERY = "copy(JSON.stringify({board:__worldIntegration.board(),storage:__worldIntegration.mainlineStorage(),mainline:__worldIntegration.mainline(),hostReply:__worldIntegration.hostResult(),nav:__worldIntegration.layout()}))"
def command(args):
    return subprocess.check_output(args, text=True)
def read_state():
    Path('/tmp/oi-read-only-query.js').write_text(QUERY)
    command(['/usr/bin/osascript', '-e', 'set the clipboard to (read POSIX file "/tmp/oi-read-only-query.js")'])
    command(['/tmp/oi-native-click', '160', '190'])
    command(['/tmp/oi-native-key', '40', 'command'])
    command(['/tmp/oi-native-key', '9', 'command'])
    command(['/tmp/oi-native-key', '36'])
    for _ in range(20):
        raw = command(['/usr/bin/pbpaste'])
        if raw != QUERY:
            data = json.loads(raw)
            assert set(k for k,v in data['storage']) == {'forest-mainline-cocos-r1-active','forest-v33-journey','forest-v3-progress','forest-v3-completed'}
            return data
        time.sleep(.1)
    raise RuntimeError('Read-only console query not completed; gameContext required')
def tile(i):
    return 993 + (i % 7)*39.2, 371 + (i // 7)*39.2
def save(name, data):
    (OUT/(name+'.json')).write_text(json.dumps(data, ensure_ascii=True, indent=2))
def replay(route, label):
    records=[]
    for index, action in enumerate(route):
        before=read_state();b=before['board']
        assert b['snapshot']['state']=='run.ready', b['snapshot']['state']
        assert action[0] in ['swap','bomb']
        if action[0]=='bomb':
            x,y=1067,704;u,v=tile(action[1])
        else:
            x,y=tile(action[1]);u,v=tile(action[2])
        command(['/tmp/oi-native-drag',str(x),str(y),str(u),str(v)])
        expected=len(b['checkpoint']['actions'])+1
        deadline=time.monotonic()+30
        while True:
            after=read_state();a=after['board']
            if len(a['checkpoint']['actions'])==expected and a['snapshot']['state'] in ['run.ready','result.saved']:
                break
            assert time.monotonic()<deadline, 'Action/state readiness timeout'
            time.sleep(.1)
        assert a['checkpoint']['actions'][-1]==action
        records.append({'action':action,'beforeState':b['snapshot']['state'],'afterState':a['snapshot']['state'],'after':a})
        save(label,{'method':'Actual normal native drag; read-only gameContext readiness+action barrier','records':records,'final':after})
        print(label,index+1,a['snapshot']['state'],flush=True)
    return after
if __name__=='__main__':
    if len(sys.argv)==2:
        save(sys.argv[1],read_state())
    else:
        route=json.loads(Path(sys.argv[1]).read_text())['actions']
        replay(route,sys.argv[2])
