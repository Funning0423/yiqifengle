from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
class Server(ThreadingHTTPServer):
    request_queue_size = 128
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
Server(('127.0.0.1', 8785), partial(Handler, directory='creator-build-project/build/web-world-r5-playable-e2fix')).serve_forever()
