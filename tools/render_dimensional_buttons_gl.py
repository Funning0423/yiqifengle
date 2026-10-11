'''Actual Mesa OpenGL rendering of the shipping triangle buffers and chest-lit.effect programs.
Engine include/entry-point wrappers are substituted; this is not a Creator runtime test.'''
import ctypes as C, ctypes.util, re,json,pathlib,math,numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'evidence/dimensional-buttons';OUT.mkdir(exist_ok=True,parents=True)
E=C.CDLL('libEGL.so.1');G=C.CDLL('libGL.so.1');
def bind(lib,name,rest,args):
 f=getattr(lib,name);f.restype=rest;f.argtypes=args;return f
P=C.c_void_p;I=C.c_int;U=C.c_uint;F=C.c_float;D=C.c_double
bind(E,'eglGetProcAddress',P,[C.c_char_p]);getPlatform=C.CFUNCTYPE(P,U,P,P)(E.eglGetProcAddress(b'eglGetPlatformDisplayEXT'));display=getPlatform(0x31DD,None,None)
for name,ret,args in [('eglInitialize',U,[P,P,P]),('eglBindAPI',U,[U]),('eglChooseConfig',U,[P,P,P,I,P]),('eglCreateContext',P,[P,P,P,P]),('eglCreatePbufferSurface',P,[P,P,P]),('eglMakeCurrent',U,[P,P,P,P])]:bind(E,name,ret,args)
a,b=I(),I();assert E.eglInitialize(display,C.byref(a),C.byref(b));assert E.eglBindAPI(0x30A2)
attrs=(I*17)(0x3033,1,0x3040,8,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,0x3038,0,0);config=P();n=I();assert E.eglChooseConfig(display,attrs,C.byref(config),1,C.byref(n)) and n.value
ctxattrs=(I*5)(0x3098,3,0x30FB,3,0x3038);ctx=E.eglCreateContext(display,config,None,ctxattrs);assert ctx
W=H=1024;pattrs=(I*5)(0x3057,W,0x3056,H,0x3038);surf=E.eglCreatePbufferSurface(display,config,pattrs);assert E.eglMakeCurrent(display,surf,surf,ctx)
for name,ret,args in [('glGetString',C.c_char_p,[U]),('glCreateShader',U,[U]),('glShaderSource',None,[U,I,P,P]),('glCompileShader',None,[U]),('glGetShaderiv',None,[U,U,P]),('glGetShaderInfoLog',None,[U,I,P,P]),('glCreateProgram',U,[]),('glAttachShader',None,[U,U]),('glLinkProgram',None,[U]),('glGetProgramiv',None,[U,U,P]),('glUseProgram',None,[U]),('glGetUniformLocation',I,[U,C.c_char_p]),('glUniformMatrix4fv',None,[I,I,U,P]),('glUniform4f',None,[I,F,F,F,F]),('glGetAttribLocation',I,[U,C.c_char_p]),('glGenVertexArrays',None,[I,P]),('glBindVertexArray',None,[U]),('glGenBuffers',None,[I,P]),('glBindBuffer',None,[U,U]),('glBufferData',None,[U,C.c_ssize_t,P,U]),('glEnableVertexAttribArray',None,[U]),('glVertexAttribPointer',None,[U,I,U,U,I,P]),('glDrawElements',None,[U,I,U,P]),('glEnable',None,[U]),('glDisable',None,[U]),('glDepthMask',None,[U]),('glBlendFuncSeparate',None,[U,U,U,U]),('glClearColor',None,[F,F,F,F]),('glClear',None,[U]),('glReadPixels',None,[I,I,I,I,U,U,P]),('glFinish',None,[]),('glDeleteBuffers',None,[I,P]),('glDeleteVertexArrays',None,[I,P])]:bind(G,name,ret,args)

bind(G,'glViewport',None,[I,I,I,I])
text=(ROOT/'creator-build-project/assets/resources/ui/warm-button-lit.effect').read_text()
vs=re.search(r'CCProgram warm-button-vs %\{(.*?)\}%',text,re.S).group(1)
fs=re.search(r'CCProgram warm-button-fs %\{(.*?)\}%',text,re.S).group(1)
p=G.glCreateProgram()
for source,typ in [(vs,0x8B31),(fs,0x8B30)]:
 source=re.sub(r'#include <[^>]+>','',source)
 source='#version 330 core\nuniform mat4 cc_matWorld; uniform mat4 cc_matViewProj;\n'+source
 if typ==0x8B31:source=source.replace('vec4 vert ()','vec4 _vert ()')+'\nvoid main(){gl_Position=_vert();}'
 else:source=source.replace('vec4 frag ()','vec4 _frag ()')+'\nout vec4 outColor;void main(){outColor=_frag();}'
 shader=G.glCreateShader(typ);b=source.encode();bp=C.c_char_p(b);G.glShaderSource(shader,1,C.byref(bp),None);G.glCompileShader(shader);ok=I();G.glGetShaderiv(shader,0x8B81,C.byref(ok))
 if not ok.value:
  buf=C.create_string_buffer(8192);G.glGetShaderInfoLog(shader,8192,None,buf);raise RuntimeError(buf.value.decode())
 G.glAttachShader(p,shader)
G.glLinkProgram(p);ok=I();G.glGetProgramiv(p,0x8B82,C.byref(ok));assert ok.value;G.glUseProgram(p)
G.glEnable(0x0B71);G.glEnable(0x0B44)
def uniform(key,m):
 a=np.array(m,dtype='float32').T.copy();G.glUniformMatrix4fv(G.glGetUniformLocation(p,key.encode()),1,0,a.ctypes.data_as(P))
def render(g):
 w,h=g['w'],g['h'];pw,ph=w*2,h*2;G.glViewport(0,0,pw,ph)
 proj=np.eye(4);proj[0,0]=2/w;proj[1,1]=2/h;proj[2,2]=-1/100
 uniform('cc_matWorld',np.eye(4));uniform('cc_matViewProj',proj)
 vao=U();G.glGenVertexArrays(1,C.byref(vao));G.glBindVertexArray(vao);buffers=[]
 for name,key,size in [('a_position','positions',3),('a_normal','normals',3),('a_color','colors',4)]:
  loc=G.glGetAttribLocation(p,name.encode());a=np.array(g[key],dtype='float32');buf=U();G.glGenBuffers(1,C.byref(buf));buffers.append(buf);G.glBindBuffer(0x8892,buf);G.glBufferData(0x8892,a.nbytes,a.ctypes.data_as(P),0x88E4);G.glEnableVertexAttribArray(loc);G.glVertexAttribPointer(loc,size,0x1406,0,0,None)
 a=np.array(g['indices'],dtype='uint16');buf=U();G.glGenBuffers(1,C.byref(buf));buffers.append(buf);G.glBindBuffer(0x8893,buf);G.glBufferData(0x8893,a.nbytes,a.ctypes.data_as(P),0x88E4)
 G.glClearColor(0,0,0,0);G.glClear(0x4000|0x0100);G.glDrawElements(4,len(a),0x1403,None);G.glFinish()
 pixels=np.zeros((ph,pw,4),dtype='uint8');G.glReadPixels(0,0,pw,ph,0x1908,0x1401,pixels.ctypes.data_as(P));assert pixels[ph//2,pw//2,3]==255
 name=f"gl-{w}x{h}-{'ivory' if g['ivory'] else 'green'}-{'pressed' if g['pressed'] else 'rest'}"
 Image.fromarray(pixels[::-1]).save(OUT/(name+'.png'))
 for b in buffers:G.glDeleteBuffers(1,C.byref(b))
 G.glDeleteVertexArrays(1,C.byref(vao))
 return {'name':name,'opaquePixels':int(np.count_nonzero(pixels[:,:,3])),'centerRGBA':pixels[ph//2,pw//2].tolist()}
samples=json.loads((OUT/'geometry.json').read_text());results=[render(g) for g in samples]
report={'status':'PASS','renderer':G.glGetString(0x1F01).decode(),'GL':G.glGetString(0x1F02).decode(),'scope':'Actual Mesa OpenGL shader compile/link/rasterization using unchanged production GLSL body, mesh vertices, normals and colours. Cocos include/uniform/entry wrappers substituted. NOT Creator or WeChat/device validation.','results':results}
(OUT/'native-shader-render.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
