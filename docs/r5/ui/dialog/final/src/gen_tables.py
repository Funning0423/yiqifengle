"""IMPLEMENT.md 附录表格（从 dialog_spec / measure_final / slices / fonts 生成）。"""
import json, os, glob
import dialog_spec as D
F = D.FINAL; out = []
rows = D.table(); json.dump(rows, open(os.path.join(D.HERE, 'screens_dialog.json'), 'w'), ensure_ascii=False, indent=1)
out.append('### A1 七种竖屏（三行台词「阿芳」，尾巴指女孩头，默认跟拍镜头）\n')
out.append('| 屏 | 档 | 字/行高 | 安全区下 | 气泡 x0 / 宽 | 气泡底 | 女孩底 | keepTop | 可用高 | 算出行数 | 每页行数 | 分页 | 气泡顶 / 高 | 尾巴 x / 尺寸 | 离女孩 | 离安全区 | 要镜头让位 |')
out.append('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for r in rows:
    out.append('| %s | %s | %d/%d | %d | %.0f / %.0f | %.0f | %.1f | %.1f | %.1f | %d | %d | %s | %.0f / %d | %s / %s | %.1f | %.0f | %s |' % (
        r['screen'], '紧凑' if r['compact'] else '常规', r['fs'], r['lh'], r['safeB'], r['x0'], r['bw'], r['bottom'], r['girl_bottom'], r['keep'], r['avail'], r['fit'], r['max_lines'],
        '+'.join(map(str, r['pages'])), r['top'], r['h'], r['tail_x'], r['tail'], r['gap_girl'], r['gap_safe'], '**是**' if r['camera_needed'] else '否'))
LIGHT = lambda j: ('sun %g / 天空 %g / %s / exposure %g' % (j['light']['sun'], j['light']['sky'], j['light']['view_transform'], j['light']['exposure'])) if 'light' in j else '夜间：月光 0.9 / 冷环境 0.55 / Standard（未改）'
out.append('\n### A2 底图来源和机位（每张底图一行）\n')
out.append('| 文件 | 角色 GLB | 场景源 | 机位 position → target（Cocos 世界坐标，m） | fov（竖直） | 女孩 root / 朝向 | 女孩投影包围盒 pt | 头 pt | 光照 |')
out.append('|---|---|---|---|---|---|---|---|---|')
for p in sorted(glob.glob(os.path.join(F, 'raw', 'bg', '*.json'))):
    j = json.load(open(p)); c = j['camera']
    out.append('| `raw/bg/%s` | `%s` | `%s` | %s → %s%s | %.0f° | %s / %.1f° | %s | %s | %s |' % (os.path.basename(p).replace('.json', '.jpg'), os.path.basename(j['char_glb']), j['island_glb'],
               c['position'], c['target'], ('（' + c['rig'].split('+ ')[1] + '）') if '+' in c['rig'] else '', c['fovVerticalDeg'], j['girl_root'], j['girl_yaw_deg'], j['girl_bbox_pt'], j['girl_head_pt'], LIGHT(j)))
m = json.load(open(os.path.join(D.HERE, 'measure_final.json')))
out.append('\n### A3 对比度（WCAG，≥ 4.5）\n')
out.append('| 模式 | 文字 | 前景 | 背景 | 对比度 |'); out.append('|---|---|---|---|---|')
for r in m['contrast']: out.append('| %s | %s | %s | %s | %.2f |' % ('白天' if r['mode'] == 'day' else '夜间', r['role'], tuple(r['fg']), tuple(r['bg']), r['ratio']))
sl = json.load(open(os.path.join(F, 'assets', 'slices.json')))
out.append('\n### A4 切图\n'); out.append('| 文件 | px（@3x） | pt | 字节 | 内边距 px [l,t,r,b] | 锚点 | 说明 |'); out.append('|---|---|---|---|---|---|---|')
for k, v in sl.items(): out.append('| `assets/%s.png` | %d×%d | %g×%g | %d | %s | %s | %s |' % (k, v['px'][0], v['px'][1], v['pt'][0], v['pt'][1], v['bytes'], v.get('insets_px', '—'), v.get('anchor', '—'), v['note']))
fm = json.load(open(os.path.join(F, 'fonts', 'measure_sizes.json'))); mf = json.load(open(os.path.join(F, 'fonts', 'fonts_manifest.json')))
out.append('\n### A5 字体子集实测（fontTools %s，本机）\n' % __import__('fontTools').version)
out.append('| 字表 | 汉字 / 总字数 | 正文 QFL Dialog Body（glyf .ttf） | gzip | 对照：保留 CFF（.otf，小游戏不收） | 名字 QFL Dialog Name（glyf .ttf） |'); out.append('|---|---|---|---|---|---|')
lab = {'A_mock': 'A 本次定稿图台词（sample_dialog）', 'B_800': 'B 随机 800 个 GB2312 一级字（估一章）', 'C_gb1_3755': 'C GB2312 一级字全部（上限）'}
for k in ('A_mock', 'B_800', 'C_gb1_3755'):
    r = fm[k]; out.append('| %s | %d / %d | **%.1f KB** | %.1f KB | %.1f KB | %.1f KB |' % (lab[k], r['han_chars'], r['total_chars'], r['body_glyf']['bytes'] / 1024, r['body_glyf']['gzip'] / 1024, r['body_cff']['bytes'] / 1024, r['name_glyf']['bytes'] / 1024))
r = fm['names_only']; out.append('| 只有名字（占位名 + …·） | %d | — | — | — | **%.1f KB**（gzip %.1f KB） |' % (r['chars'], r['name_glyf']['bytes'] / 1024, r['name_glyf']['gzip'] / 1024))
out.append('\n仓库里的 `fonts/QFLDialogName.ttf`（%d B）/ `fonts/QFLDialogBody.ttf`（%d B）是用 sample_dialog 跑出来的，只给定稿图用。' % (mf['name']['bytes'], mf['body']['bytes']))
open(os.path.join(D.HERE, 'tables.md'), 'w').write('\n'.join(out) + '\n'); print('\n'.join(out))
