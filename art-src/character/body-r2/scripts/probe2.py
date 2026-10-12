import bpy,sys,math
import numpy as np
GLB=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=GLB)
def pts(oname,mat,bones):
    o=bpy.data.objects[oname]; me=o.data; gn={g.index:g.name for g in o.vertex_groups}; out=[]
    mi=[m.name for m in me.materials].index(mat)
    vs=set()
    for p in me.polygons:
        if p.material_index==mi: vs|=set(p.vertices)
    for i in vs:
        v=me.vertices[i]; gs=sorted([(g.weight,gn[g.group]) for g in v.groups],reverse=True)
        if gs and gs[0][1] in bones: out.append(v.co[:])
    return np.array(out)
P=pts('LOD0_G2_BODY','M_G2_BODY',{'chest'})
for z in np.arange(1.13,1.42,0.02):
    s=P[(abs(P[:,2]-z)<0.01)]
    t=s[abs(s[:,0])<0.13]
    if len(t): print('BOD z%.2f n%d  |x|max %.3f  ymin %.3f ymax %.3f  allx %.3f'%(z,len(t),abs(t[:,0]).max(),t[:,1].min(),t[:,1].max(),abs(s[:,0]).max()))
D=pts('LOD0_G2_DRESS','M_G2_DRESS',{'hips','skirt.front.mid','skirt.left','skirt.right','skirt.back'})
for z in np.arange(1.08,1.16,0.01):
    s=D[abs(D[:,2]-z)<0.005]
    if len(s):
        r=[]
        for az in range(0,360,45):
            a=math.radians(az); d=np.array([math.sin(a),-math.cos(a)])
            proj=s[:,:2]@d; perp=np.abs(s[:,0]*d[1]-s[:,1]*d[0]); m=perp<0.02
            r.append(round(proj[m].max(),3) if m.any() else None)
        print('DRS z%.2f n%d'%(z,len(s)),r)
A=pts('LOD0_G2_APRON','M_G2_APRON',{'hips'})
print('APRON hips z %.3f..%.3f'%(A[:,2].min(),A[:,2].max()), 'ymin',A[:,1].min())
for side,b in (('L',{'upper_arm.L'}),('Lf',{'forearm.L'}),('Lh',{'hand.L'})):
    Q=pts('LOD0_G2_BODY','M_G2_BODY',b); print(side,len(Q),Q.min(0).round(3),Q.max(0).round(3))
