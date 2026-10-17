import sys,time,http.server,functools
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
class H(SimpleHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def log_message(self,fmt,*a):
        sys.stderr.write('%.3f %s %s\n'%(time.time(),self.address_string(),fmt%a));sys.stderr.flush()
class S(ThreadingHTTPServer):
    request_queue_size=256;daemon_threads=True;allow_reuse_address=True
port=int(sys.argv[1]);d=sys.argv[2]
S(('127.0.0.1',port),functools.partial(H,directory=d)).serve_forever()
