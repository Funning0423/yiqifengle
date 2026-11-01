from pathlib import Path
import json,subprocess,sys
p=Path(__file__).resolve().parent;r=json.loads((p/'candidate/replay.json').read_text());r['frames']=[f for f in r['frames'] if f['frame'] in [0,12,37,73]]
q=p/'candidate/keyframes.json';q.write_text(json.dumps(r))
subprocess.run([sys.executable,str(p/'posture-work/posture105/check_joint397.py'),str(p/'candidate'),str(q),str(p/'candidate/recomputed-keyframes.json'),'0','397'],check=True)
