"""Inspect actual native output. Exit 2 for default fallback, never alter output."""
from pathlib import Path
import hashlib, json, re

root = Path(__file__).resolve().parents[1]
out = root / 'creator-build-project/build/wechat-world-r6-audio'
hash_file = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
first = (out / 'first-screen.js').read_text()
def value(name):
    match = re.search(r'(?:let|const|var)\s+' + name + r'\s*=\s*([^;]+);', first)
    return match.group(1).strip() if match else None
name = (value('logoName') or '').strip("'\"")
logo = out / name
settings = json.loads((out / 'src/settings.json').read_text())['splashScreen']
expected = hash_file(root / 'tools/branding/game-title-temporary.png')
actual = hash_file(logo) if name and logo.is_file() else None
passed = value('useDefaultLogo') == 'false' and actual == expected and settings['logo']['type'] == 'custom'
report = {'status': 'PASS' if passed else 'BLOCKED_OFFICIAL_DEFAULT_FALLBACK',
          'useLogo': value('useLogo'), 'useDefaultLogo': value('useDefaultLogo'),
          'logoName': name, 'expectedSha256': expected, 'actualSha256': actual,
          'splashSettings': settings, 'runtimeFirstFrame': 'NOT_RUN'}
print(json.dumps(report, indent=2))
raise SystemExit(0 if passed else 2)
