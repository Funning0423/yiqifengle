# v2 anim_meta：登记 lantern_tuck_R 目标索引（默认 0，只在提灯动作里由曲线打开）
import json,sys
src,out,iD,iA=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]);m=json.load(open(src))
mm=m['morph']['meshes'];mm['LOD0_G2_DRESS']['targets']['lantern_tuck_R']=iD;mm['LOD0_G2_APRON']['targets']['lantern_tuck_R']=iA
m['morph']['lantern_tuck_R']={'default':0,'meshes':{'LOD0_G2_DRESS':iD,'LOD0_G2_APRON':iA},'drive':'只在提灯片段（lantern_walk / lantern_idle 等，角色动画bot 出）的 morph.curves 里打开，例 [[0,1],[dur,1]]；进出提灯用 0.2 s 渐变；其余片段不写曲线=0',
 'side':'她的右侧 = -X = hand.L 侧','tuck_m':0.010}
m.setdefault('accessories',{})['lantern_v2']={'prop':'prop_lantern_v2.glb','socket':{'parent':'hand.L','local_m':[0.010,0.080,0.006]},'core_offset_from_socket_m':None}
json.dump(m,open(out,'w'),ensure_ascii=False,indent=1)
