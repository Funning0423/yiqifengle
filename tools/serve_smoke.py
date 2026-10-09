#!/usr/bin/env python3
"""Loopback-only server for the generated Cocos debug build and explicit smoke evidence."""
import http.server, json
from pathlib import Path
BASE = Path(__file__).resolve().parents[1]
ROOT = BASE / 'creator-build-project/build/web-import-smoke'
REPORTER = r'''
<script>
window.__smokeErrors=[];
window.addEventListener('error',e=>window.__smokeErrors.push(String(e.error||e.message)));
window.addEventListener('unhandledrejection',e=>window.__smokeErrors.push(String(e.reason)));
const box=document.createElement('pre');box.id='smoke-evidence';
box.style.cssText='position:fixed;left:8px;top:8px;max-width:380px;max-height:40vh;overflow:auto;background:#fff;color:#111;font:12px monospace;padding:8px;z-index:9999;white-space:pre-wrap';
document.body.appendChild(box);
const board=document.createElement('div');board.id='r4-board';board.style.cssText='position:fixed;right:8px;top:8px;background:#182c38;color:#fff;padding:12px;z-index:9999;font:14px monospace';document.body.appendChild(board);
let sent=false;
const diagnostic=setInterval(()=>{
 const report={scope:'Mac desktop Cocos Web debug fixture; no phone acceptance',r4:window.__forestR4Smoke||null,scene:window.__forestSceneSmoke||null,errors:window.__smokeErrors};
 const live=window.__forestLiveSnapshot;
 if(live?.active){const a=live.active;board.innerHTML='<div>R4 Cocos desktop diagnostic / static B absent</div><div>'+live.state+' · moves '+a.moves+' · score '+a.score+'</div><div style="display:grid;grid-template-columns:repeat(7,32px);gap:3px">'+a.board.map(v=>'<span style="background:#496a78;text-align:center;padding:6px">'+(v?.special||v?.type||0)+'</span>').join('')+'</div>';}
 box.textContent='Cocos 3.8.8 integration smoke\n'+JSON.stringify(report,null,2);
 if(!sent&&(report.scene||report.errors.length)){sent=true;fetch('/__evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});}
},500);
</script>
'''
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def do_GET(self):
        if self.path in ['/', '/index.html']:
            data=(ROOT/'index.html').read_text().replace('</body>',REPORTER+'</body>').encode()
            self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        else: super().do_GET()
    def do_POST(self):
        if self.path != '/__evidence': self.send_error(404); return
        size=int(self.headers.get('Content-Length','0'))
        if not 0<size<100000: self.send_error(413);return
        report=json.loads(self.rfile.read(size))
        (BASE/'evidence/cocos-browser-smoke.json').write_text(json.dumps(report,indent=2)+'\n')
        self.send_response(204);self.end_headers()
    def log_message(self,*args): pass
if __name__=='__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
