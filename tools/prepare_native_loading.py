"""Set official Creator profiles in this checkout; never change information flags."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
image = root / 'tools/branding/game-title-temporary.png'
if not image.is_file():
    raise SystemExit('Temporary brand PNG missing')
splash = {
    'displayRatio': 1, 'totalTime': 500, 'watermarkLocation': 'default',
    'autoFit': True, 'logo': {'type': 'custom', 'image': str(image)},
    'background': {'type': 'color', 'color': {'x': .06, 'y': .15, 'z': .16, 'w': 1}},
}
profile = root / 'creator-build-project/settings/v2/packages/builder.json'
options = root / 'tools/wechat-world-r6-audio-build-options.json'
data = json.loads(profile.read_text())
data['splash-setting'] = splash
data['hasSetSplash'] = True
profile.write_text(json.dumps(data, indent=2) + '\n')
data = json.loads(options.read_text())
data.update(useSplashScreen=True, splashScreen=splash)
options.write_text(json.dumps(data, indent=2) + '\n')
print('Configured normal builder profiles only. Official questionnaire remains untouched.')
