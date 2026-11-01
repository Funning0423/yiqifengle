from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent;r=json.loads((p/'candidate/replay.json').read_text())
checks={"glbSHA256":"candidate/candidate.glb","animMetaSHA256":"candidate/anim_meta.json","characterMotionSHA256":"source/character-fix/creator-build-project/assets/scripts/CharacterMotion.ts","sourceSHA256":"source/runtime-excerpts/WorldIntegrationBoot-character.ts.txt"}
for field,path in checks.items():assert r[field]==hashlib.sha256((p/path).read_bytes()).hexdigest(),field
assert len(r['frames'])==397
assert {x['mesh'] for x in r['frames'][0]['morphMeshes']} >= {'LOD0_G2_BODY','LOD0_G2_DRESS','LOD0_G2_APRON'}
print('Verified combined asset, merged metadata and BOTH runtime sources actually loaded; 397 frames; body/dress/apron bindings present. Not visual acceptance.')
