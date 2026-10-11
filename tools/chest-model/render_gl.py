'''Actual Mesa OpenGL rendering of the shipping triangle buffers and chest-lit.effect programs.
Engine include/entry-point wrappers are substituted; this is not a Creator runtime test.'''
import ctypes as C, ctypes.util, re,json,pathlib,math,numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'evidence/result-chest-3d';OUT.mkdir(exist_ok=True,parents=True)
E=C.CDLL('libEGL.so.1');G=C.CDLL('libGL.so.1');
def bind(lib,name,rest,args):
 f=getattr(lib,name);f.restype=rest;f.argtypes=args;return f
P=C.c_void_p;I=C.c_int;U=C.c_uint;F=C.c_float;D=C.c_double
bind(E,'eglGetProcAddress',P,[C.c_char_p]);getPlatform=C.CFUNCTYPE(P,U,P,P)(E.eglGetProcAddress(b'eglGetPlatformDisplayEXT'));display=getPlatform(0x31DD,None,None)
for name,ret,args in [('eglInitialize',U,[P,P,P]),('eglBindAPI',U,[U]),('eglChooseConfig',U,[P,P,P,I,P]),('eglCreateContext',P,[P,P,P,P]),('eglCreatePbufferSurface',P,[P,P,P]),('eglMakeCurrent',U,[P,P,P,P])]:bind(E,name,ret,args)
a,b=I(),I();assert E.eglInitialize(display,C.byref(a),C.byref(b));assert E.eglBindAPI(0x30A2)
attrs=(I*17)(0x3033,1,0x3040,8,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,0x3038,0,0);config=P();n=I();assert E.eglChooseConfig(display,attrs,C.byref(config),1,C.byref(n)) and n.value
ctxattrs=(I*5)(0x3098,3,0x30FB,3,0x3038);ctx=E.eglCreateContext(display,config,None,ctxattrs);assert ctx
W=H=512;pattrs=(I*5)(0x3057,W,0x3056,H,0x3038);surf=E.eglCreatePbufferSurface(display,config,pattrs);assert E.eglMakeCurrent(display,surf,surf,ctx)
for name,ret,args in [('glGetString',C.c_char_p,[U]),('glCreateShader',U,[U]),('glShaderSource',None,[U,I,P,P]),('glCompileShader',None,[U]),('glGetShaderiv',None,[U,U,P]),('glGetShaderInfoLog',None,[U,I,P,P]),('glCreateProgram',U,[]),('glAttachShader',None,[U,U]),('glLinkProgram',None,[U]),('glGetProgramiv',None,[U,U,P]),('glUseProgram',None,[U]),('glGetUniformLocation',I,[U,C.c_char_p]),('glUniformMatrix4fv',None,[I,I,U,P]),('glUniform4f',None,[I,F,F,F,F]),('glGetAttribLocation',I,[U,C.c_char_p]),('glGenVertexArrays',None,[I,P]),('glBindVertexArray',None,[U]),('glGenBuffers',None,[I,P]),('glBindBuffer',None,[U,U]),('glBufferData',None,[U,C.c_ssize_t,P,U]),('glEnableVertexAttribArray',None,[U]),('glVertexAttribPointer',None,[U,I,U,U,I,P]),('glDrawElements',None,[U,I,U,P]),('glEnable',None,[U]),('glDisable',None,[U]),('glDepthMask',None,[U]),('glBlendFuncSeparate',None,[U,U,U,U]),('glClearColor',None,[F,F,F,F]),('glClear',None,[U]),('glReadPixels',None,[I,I,I,I,U,U,P]),('glFinish',None,[]),('glDeleteBuffers',None,[I,P]),('glDeleteVertexArrays',None,[I,P])]:bind(G,name,ret,args)
text=(ROOT/'creator-build-project/assets/resources/result-chest/chest-lit.effect').read_text();vs=re.search(r'CCProgram chest-vs %\{(.*?)\}%',text,re.S).group(1);fs=re.search(r'CCProgram chest-fs %\{(.*?)\}%',text,re.S).group(1)
def program(shadow=False):
 p=G.glCreateProgram()
 for source,typ in [(vs,0x8B31),(fs,0x8B30)]:
  source=re.sub(r'#include <[^>]+>','',source);source=re.sub(r'uniform ChestSurface \{ vec4 baseColor; vec4 surfaceParams; \};','uniform vec4 baseColor; uniform vec4 surfaceParams;',source)
  source='#version 330 core\n#define USE_SHADOW '+str(int(shadow))+'\nuniform mat4 cc_matWorld; uniform mat4 cc_matViewProj; uniform vec4 cc_cameraPos;\n'+source
  if typ==0x8B31:source=source.replace('vec4 vert ()','vec4 _vert ()')+'\nvoid main(){gl_Position=_vert();}'
  else:source=source.replace('vec4 frag ()','vec4 _frag ()')+'\nout vec4 outColor;void main(){outColor=_frag();}'
  shader=G.glCreateShader(typ);b=source.encode();bp=C.c_char_p(b);G.glShaderSource(shader,1,C.byref(bp),None);G.glCompileShader(shader);ok=I();G.glGetShaderiv(shader,0x8B81,C.byref(ok))
  if not ok.value:buf=C.create_string_buffer(8192);G.glGetShaderInfoLog(shader,8192,None,buf);raise RuntimeError(buf.value.decode())
  G.glAttachShader(p,shader)
 G.glLinkProgram(p);ok=I();G.glGetProgramiv(p,0x8B82,C.byref(ok));assert ok.value;return p
solid=program(False);shadow=program(True);DATA=json.loads(re.search(r'export const RESULT_CHEST_GEOMETRY=(.*);', (ROOT/'creator-build-project/assets/scripts/ResultChestGeometry.ts').read_text(),re.S).group(1));G.glEnable(0x0B71);G.glEnable(0x0B44)
def uniform(p,k,v):
 loc=G.glGetUniformLocation(p,k.encode());a=np.array(v,dtype='float32').T.copy();G.glUniformMatrix4fv(loc,1,0,a.ctypes.data_as(P))
def draw(p,g,world,vp,eye,material=None):
 G.glUseProgram(p);uniform(p,'cc_matWorld',world);uniform(p,'cc_matViewProj',vp);G.glUniform4f(G.glGetUniformLocation(p,b'cc_cameraPos'),*eye,1)
 if material:
  m=DATA['materials'][material];G.glUniform4f(G.glGetUniformLocation(p,b'baseColor'),*m['color']);G.glUniform4f(G.glGetUniformLocation(p,b'surfaceParams'),m['wood'],m['metal'],0,0)
 vao=U();G.glGenVertexArrays(1,C.byref(vao));G.glBindVertexArray(vao);buffers=[]
 for name,key,size in [('a_position','positions',3),('a_normal','normals',3),('a_color','colors',4)]:
  loc=G.glGetAttribLocation(p,name.encode())
  if loc<0:continue
  a=np.array(g[key],dtype='float32');buf=U();G.glGenBuffers(1,C.byref(buf));buffers.append(buf);G.glBindBuffer(0x8892,buf);G.glBufferData(0x8892,a.nbytes,a.ctypes.data_as(P),0x88E4);G.glEnableVertexAttribArray(loc);G.glVertexAttribPointer(loc,size,0x1406,0,0,None)
 a=np.array(g['indices'],dtype='uint16');buf=U();G.glGenBuffers(1,C.byref(buf));buffers.append(buf);G.glBindBuffer(0x8893,buf);G.glBufferData(0x8893,a.nbytes,a.ctypes.data_as(P),0x88E4);G.glDrawElements(4,len(a),0x1403,None)
 for b in buffers:G.glDeleteBuffers(1,C.byref(b))
 G.glDeleteVertexArrays(1,C.byref(vao))
def view(eye,target):
 z=(eye-target);z/=np.linalg.norm(z);x=np.cross([0,1,0],z);x/=np.linalg.norm(x);y=np.cross(z,x);m=np.eye(4);m[:3,:3]=[x,y,z];m[:3,3]=-m[:3,:3]@eye;return m
def render(open,name,frameData=None,shadowData=None):
 f=frameData or json.loads((OUT/('frame-'+str(open)+'.json')).read_text());h=f['halfHeight'];origin=np.array([10000,10000,10000]);eye=origin+np.array(f['position']);target=origin+np.array(f['focus']);proj=np.eye(4);proj[0,0]=proj[1,1]=1/h;proj[2,2]=-2/(30-.1);proj[2,3]=-(30+.1)/(30-.1);vp=proj@view(eye,target)
 G.glClearColor(0,0,0,0);G.glClear(0x4000|0x0100);angle=math.radians(DATA['openDegrees'])*open;ca,sa=math.cos(angle),math.sin(angle);rot=np.array([[1,0,0,0],[0,ca,-sa,0],[0,sa,ca,0],[0,0,0,1]],float)
 for g in DATA['meshes']:
  world=np.eye(4)
  if g['part']=='lid':world[:3,3]=DATA['hinge'];world=world@rot
  world[:3,3]+=origin;draw(solid,g,world,vp,eye,g['material'])
 # Use exported production shadow buffers, generated by the exact TypeScript function.
 shadowpath=OUT/('shadow-'+str(open)+'.json')
 if shadowData is not None or shadowpath.exists():
  sg=shadowData or json.loads(shadowpath.read_text());world=np.eye(4);world[:3,3]=origin;G.glDisable(0x0B44);G.glEnable(0x0BE2);G.glBlendFuncSeparate(0x0302,0x0303,1,0x0303);G.glDepthMask(0);draw(shadow,sg,world,vp,eye);G.glDepthMask(1);G.glDisable(0x0BE2);G.glEnable(0x0B44)
 G.glFinish();pixels=np.zeros((H,W,4),dtype='uint8');G.glReadPixels(0,0,W,H,0x1908,0x1401,pixels.ctypes.data_as(P));Image.fromarray(pixels[::-1]).save(OUT/(name+'.png'));return int(np.count_nonzero(pixels[:,:,3]))
counts={}
for v,name in [(0,'native-shader-closed'),(.5,'native-shader-half'),(1,'native-shader-opened')]:counts[name]=render(v,name)
report={'status':'PASS','renderer':G.glGetString(0x1F01).decode(),'GL':G.glGetString(0x1F02).decode(),'scope':'Actual Mesa OpenGL using shipping mesh and effect source, replacing Cocos uniform/entry wrappers. NOT Creator, WeChat or device validation.','pixelCounts':counts};(OUT/'shader-render.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

import sys
if '--animation' in sys.argv:
 (OUT/'animation').mkdir(exist_ok=True)
 for i,info in enumerate(json.loads((OUT/'animation-geometry.json').read_text())):render(info['open'],'animation/frame-'+str(i).zfill(3),info['frame'],info['shadow'])
