# 在 hand.L 下追加非关节节点 socket.lantern（只追加在 nodes 末尾 + hand.L.children 末尾，其他节点索引不变）
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));from glb import G
src,out=sys.argv[1:3];g=G(src);j=g.j;h=[i for i,n in enumerate(j['nodes']) if n['name']=='hand.L'][0]
j['nodes'].append({'name':'socket.lantern','translation':[0.0138,0.0803,0.0073],'rotation':[-0.78587,0.05101,0.18423,0.58811]})
j['nodes'][h].setdefault('children',[]).append(len(j['nodes'])-1);g.save(out);print('SOCK',h,len(j['nodes'])-1)
