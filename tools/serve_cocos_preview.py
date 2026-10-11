"""Local isolated Cocos asset preview. Increased queue for parallel GLTF dependencies."""
import functools, http.server, sys
class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if args and str(args[1]) != '200':
            super().log_message(fmt, *args)
Server(('127.0.0.1', int(sys.argv[1])), functools.partial(Handler, directory=sys.argv[2])).serve_forever()
