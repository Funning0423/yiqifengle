import json
d=json.load(open('work/inspect_r5h3.json'))
L=['','### 2.4 Blender 实读（work/inspect_r5h3.json，自动生成）']
v=d['view'];L.append(f"- 色彩管理：view_transform **{v['view_transform']}**，look **{v['look']}**，exposure **{v['exposure']}**，gamma {v['gamma']}，引擎 {v['engine']}。")
L.append('- 灯光：'+'；'.join(f"{l['name']} {l['type']} energy {round(l['energy'],3)} color {[round(c,3) for c in l['color']]}{' (hide_render)' if l['hide_render'] else ''}" for l in d['lights']))
if 'world' in d:
  for n in d['world']['nodes']:
    if n['type'] in('ShaderNodeBackground','ShaderNodeValToRGB'): L.append(f"- 世界 {n['name']}: {n.get('ramp') or n['inputs']}")
for name,o in d['objects'].items():
  if not o['visible'] and o['hide_render']: continue
  L.append(f"- 物体 `{name}`（{o['data']}，集合 {o['collections']}，可见 {o['visible']}，hide_render {o['hide_render']}，位置 {o['loc']}，材质 {o['mats']}，色属性 {o['color_attrs']}）")
  if o.get('vcol_top'): L.append(f"  - 顶点色（线性）前几位：{o['vcol_top'][:6]}")
for m,info in d['materials'].items():
  L.append(f"- 材质 `{m}`（blend {info.get('blend_method')}）：")
  for n in info['nodes']:
    if n['type'] in('ShaderNodeBsdfPrincipled',):
      keep={k:v for k,v in n['inputs'].items() if k in('Base Color','Roughness','IOR','Alpha','Metallic','Specular IOR Level','Emission Strength','Transmission Weight','Coat Weight','Normal')}
      L.append(f"  - Principled：{keep}")
    elif n['type'] in('ShaderNodeVertexColor','ShaderNodeAttribute','ShaderNodeTexImage','ShaderNodeMix','ShaderNodeBump','ShaderNodeTexNoise','ShaderNodeValToRGB','ShaderNodeLayerWeight','ShaderNodeFresnel'):
      ex={k:n[k] for k in('layer','image','colorspace','blend_type','ramp') if k in n}
      L.append(f"  - {n['type'].replace('ShaderNode','')} {n['name']} {ex} {dict(list(n['inputs'].items())[:4])}")
open('work/inspect_summary.md','w').write('\n'.join(L)+'\n')
s=open('REFERENCE.md').read()
mark='### 2.4 Blender 实读'
if mark in s: s=s[:s.index(mark)].rstrip()+'\n'
s=s.replace('<!--INSPECT_PENDING-->','')
i=s.index('## 3. 原因判断'); s=s[:i]+'\n'.join(L[1:])+'\n\n'+s[i:]
open('REFERENCE.md','w').write(s); print('FMT_OK')
