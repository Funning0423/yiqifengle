import http.server
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'creator-build-project/build/web-import-smoke'
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**k):super().__init__(*a,directory=str(root),**k)
 def log_message(self,*a):pass
http.server.ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
