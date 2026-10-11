"""Inspect an actual WeChat build output for the custom first screen (GGbot, docs/first-screen.md). Never alters output.
Usage: python3 tools/verify_native_loading.py [<wechat build dir>]   (default creator-build-project/build/wechat-world-r6-audio)
PASS = first-screen.js is byte-identical to build-templates/wechatgame/first-screen.js (the template copy ran last),
       every startup-art/* file is in the MAIN package (not under a subpackage root) with the template's bytes,
       and first-screen.js references no template logo/slogan image. Leftover template images are reported, not failed.
Exit 0 PASS, 2 BLOCKED (generated Cocos first screen or missing art)."""
from pathlib import Path
import hashlib, json, sys

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'creator-build-project/build/wechat-world-r6-audio'
tpl = root / 'creator-build-project/build-templates/wechatgame'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
first = out / 'first-screen.js'
text = first.read_text(encoding='utf-8') if first.is_file() else ''
art = {str(p.relative_to(tpl)): sha(p) for p in sorted((tpl / 'startup-art').iterdir()) if p.is_file()}
try:
    subs = [s['root'].rstrip('/') for s in json.loads((out / 'game.json').read_text()).get('subpackages', [])]
except Exception:
    subs = []
artOut = {k: (sha(out / k) if (out / k).is_file() else None) for k in art}
inSub = [k for k in art if any(k.startswith(r + '/') for r in subs)]
leftovers = [n for n in ('logo.png', 'slogan.png', 'background.png') if (out / n).is_file()]
refs = [n for n in ('logo.png', 'slogan.png', 'background.png', 'useDefaultLogo') if n in text]
checks = {'firstScreenIsTemplate': first.is_file() and sha(first) == sha(tpl / 'first-screen.js'),
          'artInMainPackage': all(artOut[k] == art[k] for k in art) and not inSub,
          'noTemplateLogoReference': not refs}
passed = all(checks.values())
report = {'status': 'PASS' if passed else 'BLOCKED_GENERATED_FIRST_SCREEN_OR_ART', 'out': str(out), 'checks': checks,
          'firstScreenSha256': sha(first) if first.is_file() else None, 'art': artOut, 'artBytes': sum((out / k).stat().st_size for k in art if (out / k).is_file()),
          'unusedTemplateImagesInOutput': {n: (out / n).stat().st_size for n in leftovers}, 'runtimeFirstFrame': 'NOT_RUN'}
print(json.dumps(report, indent=2))
raise SystemExit(0 if passed else 2)
