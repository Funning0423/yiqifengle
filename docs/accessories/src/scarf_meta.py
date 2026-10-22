# 在原 anim_meta 上追加围巾风层说明（不改 clips）
import json,sys
src,out=sys.argv[1:3];m=json.load(open(src))
w=m['wind'];w['mask']=sorted(set(w['mask'])|{'scarf*'},key=w['mask'].index if False else None) if False else w['mask']+(['scarf*'] if 'scarf*' not in w['mask'] else [])
w['scarf']={'bone':'scarf.tail','joint_index':29,'parent':'neck','coef':0.5,'limit_deg':{'back':35,'lateral':20},
 'axes':'scarf.tail 局部轴与 neck 一致（绑定姿态=世界轴）：绕 +X 正转=尾尖向后(-Z)，绕 +Z 转=左右；上限按 neck 系计',
 'qa_note':'角色建模bot QA：向后>约10°尾巴即压进胸口（20° 时 69–82 对），35° 后摆上限在胸前尾巴上不可达；向前 35°/左右 20° 为 0。建议烘焙时后摆限 10°，顶风改为左右+向前上扬。',
 'channels':'v1 不带 scarf.tail 动画通道（静止跟随 neck），风通道由角色动画bot 烘焙'}
m.setdefault('accessories',{})['scarf_v1']={'mesh':'LOD0_G2_SCARF','tris':400,'material':'M_G2_SCARF','texture':'T_G2_SCARF_64 (png)'}
json.dump(m,open(out,'w'),ensure_ascii=False,indent=1)
