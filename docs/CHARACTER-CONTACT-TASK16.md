# Task16 lower cloth contact candidate — FAIL/OPEN

Fixed task15 input375fb067. No BODY, base positions, original morph, skin weights, rig, original animation, UV, materials, textures or indices changed. New welded sparse contact fields affect146dress and192apron vertices; maximum9.399mm and5.524mm. Independent cuff correction14apron vertices maximum2.085mm addresses faces537/539 around.265s. No geometry hidden and thresholds unchanged.

The previous rejected lower solver output was an analysis seed, not an accepted full-motion correction. Early sit_down basis fields9–12 are removed entirely, preserving the original early return contact geometry. Late return support grows continuously from zero at.6s. Stand_up excludes the proven conflicting sleeve-approach contact interval via continuous support with zero across.17–.215s. Two early-return ramp experiments were rejected after additional samples found per-pair increases; neither was packaged.

Reproduction: `python3 tools/offline-character/repair_lower_task16.py` reads fixed task15 GLB from Git and writes deterministic sparse morphs plus matching metadata at the existing resource/UUID. Normals are rebuilt only for affected morph triangles. Runtime controller and foot/UI/grassland sources are unchanged; Boot diagnostic identity is updated.

Installed asset381pose check:300dense failures119→61; stand_up42→13; sit_down77→48; all381failures172→114; no per-pair increases. Sleeve/APRON8→0; dense leg/DRESS4469→3087; leg/APRON1883→1855; APRON/DRESS1925→570. Cuff additional66samples at1ms:.235–.300s sleeve60→0, no increase in any pair. Early return and remaining return leg/layer failures remain open; the prior12upper-waist-containing poses are not assumed unchanged. Natural runtime, screenshots and additional boundary evidence are recorded separately and do not follow from CPU clip sampling.

Not release approved. Body/boots preserve the previously passed508subitem; phone, extended ground contact, performance, full sleeve angles and remaining natural motion failures are still open.
