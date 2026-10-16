import sys
src=open('/tmp/vbw/render.py').read().replace("for name,q in shots.items():","for name,q in []:")
exec(src)
