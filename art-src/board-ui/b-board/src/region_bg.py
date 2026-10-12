# One region board background (render_bg.py output -> 750×1624 JPG q70, same post as bg_island_board) + its row in slices/sizes.json.
# python3 region_bg.py <bg_raw.png> <name> [note]      e.g.  python3 src/region_bg.py /tmp/bg_sky_raw.png bg_skycity_board
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from boardpost import background as bg_post
BGRAW, NAME = sys.argv[1:3]; NOTE = sys.argv[3] if len(sys.argv) > 3 else ''
SL = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'slices')
p = os.path.join(SL, NAME + '.jpg'); bg_post(BGRAW).save(p, quality=70, optimize=True, progressive=True, subsampling=2)
sp = os.path.join(SL, 'sizes.json'); rows = [r for r in json.load(open(sp)) if r['file'] != NAME + '.jpg']
rows.append(dict(file=NAME + '.jpg', group='背景', w=750, h=1624, bytes=os.path.getsize(p), note=NOTE))
json.dump(rows, open(sp, 'w'), ensure_ascii=False, indent=1)
print(NAME + '.jpg', os.path.getsize(p))
