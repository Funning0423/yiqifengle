#!/usr/bin/env python3
"""Copy the phase-1 board / popup art (art-src/board-ui) into the Cocos project with hand-written metas.

  python3 tools/board_art_sync.py          # copy + (re)write metas; uuids are stable (uuid5 of the target path)
  python3 tools/board_art_sync.py --check  # exit 1 when a target is missing or differs from its source

Targets:
  assets/bundles/board_art/   subpackage bundle: board skin, popup kit, r2/r3 panels, reward chest GLB, licence texts
  assets/bundles/region_island/board/bg_island_board.jpg   level background (island bundle is always loaded)
  assets/bundles/region_skycity/board/bg_skycity_board.jpg  天空回声 (r05-sky) board background
Not copied on purpose (handoff rules): slices/_rejected/, result_chest_preview.glb, cabin_bubble.png (PM: no bubble),
the three regional tool renders (tool_tidenet/sunseed/starshears: not confirmed by Funning; tools-original.png stays).
"""
import hashlib, json, os, shutil, sys, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'art-src', 'board-ui')
ASSETS = os.path.join(ROOT, 'creator-build-project', 'assets')
NS = uuid.UUID('6b3c0f52-4f7e-4a8e-9d55-0c1a2b3d4e5f')

B = 'b-board/slices/'
C = 'c-popups/slices/'
R2 = 'c-popups/r2/slices/'
R3 = 'c-popups/r3/slices/'
BOARD = ['piece_strawberry', 'piece_leaf', 'piece_blueberry', 'piece_flower', 'piece_acorn', 'piece_shell',
         'special_line_h', 'special_line_v', 'special_bomb', 'obstacle_moss', 'obstacle_roots', 'obstacle_shell_1',
         'obstacle_shell_2', 'tile_a', 'tile_b', 'tray_frame', 'hud_pause', 'hud_levelplate', 'icon_moves',
         'tool_starlight', 'tool_windbell', 'tool_tidebottle']
POPUP = ['panel_frame_9s', 'title_plank_3s', 'btn_primary_3s', 'btn_secondary_3s', 'btn_close', 'tile_restart',
         'tile_bag', 'tile_settings', 'icon_music', 'icon_sfx', 'icon_sun', 'icon_moon', 'icon_motion', 'icon_home',
         'icon_about', 'icon_play', 'toggle_on', 'toggle_off', 'toggle_knob', 'star_full', 'star_empty',
         'reward_seal_tide', 'reward_seal_meadow', 'reward_seal_sky', 'chest_closed', 'fx_rays', 'stamp_claimed',
         'title_0', 'title_1', 'title_2', 'title_3', 'title_4', 'title_5']
R2_FILES = {'sign_plank_3s': 'sign_plank_3s', 'region_tide': 'region_tide', 'region_meadow': 'region_meadow',
            'region_sky': 'region_sky', 'hero_starlight': 'hero_starlight', 'hero_windbell': 'hero_windbell',
            'hero_tidebottle': 'hero_tidebottle', 'icon_charm': 'icon_charm', 'icon_lock': 'icon_lock',
            'beacon_lighthouse': 'beacon_lighthouse', 'beacon_ring': 'beacon_ring',
            'title_星光': 'title_starlight', 'title_旅人的行囊': 'title_bag', 'title_旅程册': 'title_journey',
            'title_海岛小憩': 'title_rest', 'title_还没存上': 'title_unsaved', 'title_旅途回顾': 'title_review',
            'chapter_潮汐小径': 'chapter_tide', 'chapter_花粉草甸': 'chapter_meadow', 'chapter_天空回声': 'chapter_sky'}
R3_FILES = {'cabin_glow': 'cabin_glow', 'title_关于': 'title_about', 'about_gamename': 'about_gamename'}

def pairs():
    out = []
    for n in BOARD: out.append((B + n + '.png', 'bundles/board_art/board/' + n + '.png'))
    for n in POPUP: out.append((C + n + '.png', 'bundles/board_art/popup/' + n + '.png'))
    for s, d in R2_FILES.items(): out.append((R2 + s + '.png', 'bundles/board_art/r2/' + d + '.png'))
    for s, d in R3_FILES.items(): out.append((R3 + s + '.png', 'bundles/board_art/r3/' + d + '.png'))
    out.append((C + 'result_chest.glb', 'bundles/board_art/chest/result_chest.glb'))
    out.append(('a-loading/src/OFL.txt', 'bundles/board_art/licenses/lxgw-wenkai-ofl.txt'))
    out.append(('../../tools/t6-cheer-text/font/OFL.txt', 'bundles/board_art/licenses/fredoka-ofl.txt'))
    out.append(('../../docs/MAINLINE-BABEL-HELPERS-LICENSE.txt', 'bundles/board_art/licenses/babel-helpers-mit.txt'))
    out.append((B + 'bg_island_board.jpg', 'bundles/region_island/board/bg_island_board.jpg'))
    out.append((B + 'bg_skycity_board.jpg', 'bundles/region_skycity/board/bg_skycity_board.jpg'))
    return out

def uid(rel): return str(uuid.uuid5(NS, rel))

def image_meta(rel, alpha):
    u = uid(rel); name = os.path.splitext(os.path.basename(rel))[0]
    return {"ver": "1.0.27", "importer": "image", "imported": True, "uuid": u, "files": [".json", os.path.splitext(rel)[1]],
            "subMetas": {"6c48a": {"importer": "texture", "uuid": u + "@6c48a", "displayName": name, "id": "6c48a",
                                   "name": "texture", "userData": {"wrapModeS": "clamp-to-edge", "wrapModeT": "clamp-to-edge",
                                   "minfilter": "linear", "magfilter": "linear", "mipfilter": "none", "anisotropy": 0,
                                   "isUuid": True, "imageUuidOrDatabaseUri": u, "visible": False},
                                   "ver": "1.0.22", "imported": True, "files": [".json"], "subMetas": {}}},
            "userData": {"type": "texture", "fixAlphaTransparencyArtifacts": False, "hasAlpha": alpha, "redirect": u + "@6c48a"}}

def meta_for(rel):
    ext = os.path.splitext(rel)[1].lower()
    if ext in ('.png', '.jpg'): return image_meta(rel, ext == '.png')
    if ext == '.glb': return {"ver": "2.3.14", "importer": "gltf", "imported": False, "uuid": uid(rel), "files": [], "subMetas": {}, "userData": {"tangents": 1}}
    if ext == '.txt': return {"ver": "1.0.1", "importer": "text", "imported": True, "uuid": uid(rel), "files": [".json"], "subMetas": {}, "userData": {}}
    raise ValueError(rel)

def dir_meta(rel, bundle=None):
    m = {"ver": "1.2.0", "importer": "directory", "imported": True, "uuid": uid(rel), "files": [], "subMetas": {}, "userData": {}}
    if bundle: m["userData"] = {"isBundle": True, "bundleConfigID": "wx_subpackage", "bundleName": bundle, "priority": 1,
                                "compressionType": {"wechatgame": "subpackage"}, "isRemoteBundle": {"wechatgame": False}}
    return m

def dump(p, obj):
    with open(p, 'w') as f: f.write(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def main():
    check = '--check' in sys.argv; bad = []
    dirs = {'bundles/board_art': 'board_art'}
    for src, dst in pairs():
        s = os.path.normpath(os.path.join(ART, src)); d = os.path.join(ASSETS, dst)
        if check:
            if not os.path.isfile(d) or sha(s) != sha(d) or not os.path.isfile(d + '.meta'): bad.append(dst)
            continue
        os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copyfile(s, d); dump(d + '.meta', meta_for(dst))
        parent = os.path.dirname(dst)
        while parent.startswith('bundles/') and parent.count('/') >= 2:
            dirs.setdefault(parent, None); parent = os.path.dirname(parent)
    if check:
        print('board art', 'OK' if not bad else 'MISMATCH ' + ', '.join(bad)); return 1 if bad else 0
    for rel, bundle in dirs.items():
        p = os.path.join(ASSETS, rel + '.meta')
        if bundle or not os.path.exists(p): dump(p, dir_meta(rel, bundle))
    print('copied', len(pairs()), 'files')
    return 0

if __name__ == '__main__': sys.exit(main())
