import sys;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
J,B=load(sys.argv[1]);D=set(sys.argv[3:]);J['animations']=[a for a in J['animations'] if a['name'] not in D];save(sys.argv[2],J,B)
