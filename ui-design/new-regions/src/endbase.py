# 干净的结局底图：复用 post-island v2.1 的分层渲染（ui/post-island-ui，src/ending.py），去掉旧 4 印章；
# 女孩头顶下限随印章带高度下移（extra）。返回 (RGBA @2x, layout)
import os,sys,types
PI='/workspace/wechat-game/work/post-island-ui/ui-design/post-island/src/'
sys.path.insert(0,PI); _cwd=os.getcwd(); os.chdir(PI)
src=open(PI+'ending.py').read()
src=src.replace("seals=['tide','meadow','sky','lake'];","seals=[];")
src=src.replace("top=L['seals_cy']+22+12","top=L['seals_cy']+22+12+EXTRA[0]")
src=src.replace("if __name__=='__main__':","if False:")
mod=types.ModuleType('pi_ending'); mod.__dict__['EXTRA']=[0]; mod.__dict__['__file__']=PI+'ending.py'
exec(compile(src,PI+'ending.py','exec'),mod.__dict__); os.chdir(_cwd)
_c={}
def base(W,H,extra=0,night=False):
  k=(W,H,extra,night)
  if k not in _c:
    mod.EXTRA[0]=extra; im,L=mod.ending(W,H,night=night); _c[k]=(im,L)
  return _c[k]
