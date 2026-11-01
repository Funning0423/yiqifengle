"""把 spec.py 的数值打成 Markdown 表（IMPLEMENT.md 附录 A/B 直接贴这份输出）。"""
import spec, json, os
def r(v): return ('%.1f' % v).rstrip('0').rstrip('.')
out = []
out.append('## 附录 A · 7 种竖屏取值（h 与奖励件数无关）\n')
out.append('| 屏幕 | 安全区来源 | T 顶带 | B 底 | 可用高 A | popupScale | 面板宽 pw | 内容宽 ci | 档位 | h 开箱前 | h 开箱后 | h 失败 | 面板上沿(开) | 面板下沿 | 下沿→安全底 | 按钮宽 |')
out.append('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for x in spec.table():
    out.append('| %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |' % (x['screen'], x['safe'], r(x['T']), r(x['B']), r(x['A']), x['scale'], x['pw'], x['ci'], x['tier'], x['h_closed'], x['h_open'], x['h_lose'], r(x['top_open']), r(x['bottom']), r(x['gap_bottom']), r(x['btn_w'])))
out.append('\n各档高度（win 开箱前 / 开箱后，失败，未保存/只读）：')
for k in spec.ORDER: out.append('- %s：%s / %s，%s，%s' % (k, *spec.heights(spec.TIERS[k], 'win', 1), spec.heights(spec.TIERS[k], 'lose')[0], spec.heights(spec.TIERS[k], 'unsaved')[0]))
def nodes(W, H, kind, state, n=2):
    L = spec.layout(W, H, kind, state, n_side=n, names=('星光 ×2', '潮汐网'), icons=('board/tool_starlight', 'r2/tool_tidenet')); P = L['panel']
    out.append('\n#### %d×%d · %s%s（档位 %s；面板 %s×%s，屏幕上沿 y=%s）\n' % (W, H, kind, (' · ' + state) if kind == 'win' else '', L['tier'], P['w'], P['h'], r(P['top'])))
    out.append('| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |')
    out.append('|---|---|---|---|---|---|---|')
    for nd in L['nodes']:
        if nd.get('fallback') or nd['name'] == 'PanelFrame': continue
        what = nd.get('sprite') or nd.get('text') or ('3D RT 方框' if nd.get('rt') else 'glow' if nd.get('glow') else 'hit 区' if nd.get('hit') else '辅助线' if nd.get('guide') else '')
        out.append('| %s | %s | %s | (%s, %s) | %s | %s | %s |' % (nd['name'], r(nd['lx']), r(nd['ly']), r(nd['lx']), r(P['h'] / 2 - nd['ly']), r(nd['w']), r(nd['h']), what))
out.append('\n## 附录 B · 节点坐标表（全部锚点 0.5/0.5；坐标是节点中心）')
for W, H in [(390, 844), (375, 667)]:
    for kind, st in [('win', 'closed'), ('win', 'open'), ('lose', None), ('unsaved', None)]: nodes(W, H, kind, st)
for W, H in [(320, 568), (390, 520)]: nodes(W, H, 'win', 'open')
open(os.path.join(spec.HERE, 'tables.md'), 'w').write('\n'.join(out) + '\n'); print('\n'.join(out[:20]))
