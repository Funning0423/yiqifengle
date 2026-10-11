"""Add-only, dry-run-by-default installer. Never changes a .meta, GLB, scene, Boot or UI file."""
import argparse,pathlib,json,hashlib,shutil
p=argparse.ArgumentParser();p.add_argument('--project',required=True);p.add_argument('--apply',action='store_true');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];project=pathlib.Path(a.project).resolve();package=json.loads((project/'package.json').read_text())
assert package.get('creator',{}).get('version')=='3.8.8','Integrator must review a different engine patch explicitly'
# Read only source GLB to verify the geometry/anchor contract before copying any code.
facts=json.loads((root/'evidence/asset-facts.json').read_text())
assets=project/'assets/resources/firstslice'
for name,digest in facts['source'].items():
 data=(assets/name).read_bytes();assert hashlib.sha256(data).hexdigest()==digest, 'Frozen asset differs: '+name
dest=project/'assets/scripts/world-r1';assert not dest.exists(),'Destination already exists; review/update explicitly instead of overwriting'
files=list((root/'components').glob('*.ts'));assert len(files)==7
for f in files:print(f'{f.name} -> {dest/f.name}')
if a.apply:
 dest.mkdir()
 for f in files:shutil.copyfile(f,dest/f.name)
 print('Added 7 new TS files only. Open Creator to generate new .meta; wire a new scene manually per README.')
else:print('DRY RUN ONLY. No files changed.')
