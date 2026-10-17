#!/usr/bin/env python3
"""Read-only E4 asset audit. Runs no package code and changes no package files."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, re, sys
import numpy as np
from PIL import Image

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '/workspace/shared/e4-v133-review/source/20261010T0207Z-grokbot2-E4-MATERIALS-v1.3.3').resolve()
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else '/workspace/shared/e4-v133-review/asset-results.json')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
files = sorted(p for p in ROOT.rglob('*') if p.is_file())
all_hashes = {str(p.relative_to(ROOT)): sha(p) for p in files}
expected_sources = {
    'day_v01a_2048': '153979281ac0b9a96d360245f59ad3b02438b1a39082afbca5cefc647959a4b8',
    'night_v01a_2048': '1fd02ba7284fe9dec25e2a2ea3deb5e8a10ebf9c014ef058c793b8883f39acd0',
}
images = []
for p in files:
    if p.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'):
        continue
    with Image.open(p) as im:
        im.load()
        images.append({'path': str(p.relative_to(ROOT)), 'size': list(im.size), 'mode': im.mode, 'format': im.format, 'file_bytes': p.stat().st_size, 'sha256': sha(p), 'image_metadata_keys': sorted(im.info)})

p = ROOT / 'runtime/textures/tex_meadow_sky_night_1024x512.png'
with Image.open(p) as im:
    a = np.asarray(im.convert('RGB'), dtype=np.float64)
    actual_size, actual_mode = list(im.size), im.mode
h, w, _ = a.shape
lower_start = 439
lower = a[lower_start:512]
row_means = lower.mean(axis=1)
col_medians = np.median(lower, axis=0)
luma = lambda x: np.sum(x * np.array([.2126, .7152, .0722]), axis=-1)
first_center = int(np.floor(.857*h + .5))
summary = lambda x: {'min_rgb': x.min(axis=tuple(range(x.ndim-1))).tolist(), 'max_rgb': x.max(axis=tuple(range(x.ndim-1))).tolist(), 'mean_rgb': x.mean(axis=tuple(range(x.ndim-1))).tolist()}

presets_path = ROOT / 'runtime/textures-meta/texture-compress-presets.e4.json'
presets = json.loads(presets_path.read_text())
user_presets = presets['textureCompressConfig']['userPreset']
metas = []
for p in sorted((ROOT / 'runtime/textures-meta').glob('*.meta')):
    data = json.loads(p.read_text())
    asset_name = p.name[:-5]
    sub_id, sub = next(iter(data['subMetas'].items()))
    ud = sub['userData']
    comp = data['userData']['compressSettings']
    preset_id = comp['presetId']
    matching = [str(q.relative_to(ROOT)) for q in files if q.name == asset_name]
    metas.append({
        'path': str(p.relative_to(ROOT)), 'asset_name': asset_name,
        'asset_paths_in_package': matching, 'uuid': data['uuid'],
        'uuid_links_internally_consistent': sub['uuid'] == data['uuid']+'@'+sub_id and data['userData']['redirect'] == sub['uuid'] and ud['imageUuidOrDatabaseUri'] == data['uuid'],
        'display_name_matches_asset_stem': sub['displayName'] == Path(asset_name).stem,
        'subresource_name': sub['name'], 'wrapS': ud['wrapModeS'], 'wrapT': ud['wrapModeT'],
        'minfilter': ud['minfilter'], 'magfilter': ud['magfilter'], 'mipfilter': ud['mipfilter'],
        'compression_declaration': comp,
        'preset_reference_resolves_in_template': preset_id in user_presets if comp['useCompressTexture'] else preset_id == '',
        'preset_options': user_presets[preset_id]['options'] if preset_id in user_presets else None,
        'adjacent_asset_in_package': p.with_name(asset_name).exists(),
        'project_import_build_status': 'not_run; separate hand-authored template, not evidence of imported or built settings'
    })

script = (ROOT/'runtime/scripts/SkyNightTexture.ts').read_text()
constants = dict(re.findall(r"export const (SKY_NIGHT_(?:BUNDLE|ASTC_PATH|NOASTC_PATH))='([^']+)';", script))
paths = []
for key in ['SKY_NIGHT_ASTC_PATH', 'SKY_NIGHT_NOASTC_PATH']:
    value = constants[key]
    stem = value.removeprefix('textures/').removesuffix('/texture')
    matching = [m for m in metas if Path(m['asset_name']).stem == stem]
    paths.append({'constant': key, 'path': value, 'bundle': constants['SKY_NIGHT_BUNDLE'], 'matching_meta': [m['path'] for m in matching], 'matching_assets': [x for m in matching for x in m['asset_paths_in_package']], 'subresource_suffix_matches_meta': bool(matching) and all(m['subresource_name'] == 'texture' for m in matching), 'expected_project_directory': 'assets/bundles/'+constants['SKY_NIGHT_BUNDLE']+'/textures/'})

raw1024_sha = all_hashes['runtime/textures/tex_meadow_sky_night_1024x512.png']
expected1024 = '2cbc0e9e92df842d21ece97ac9cb9b5322028a3fc00ff948a9f96872ba315e6d'
exact_mip_pixels = lambda width,height: sum(max(1,width >> i)*max(1,height >> i) for i in range(max(width,height).bit_length()))
result = {
    'audit': {'created_utc': datetime.now(timezone.utc).isoformat(), 'root': str(ROOT), 'method': 'Independent read-only Python/Pillow/NumPy pixel, file hash and JSON/static path inspection; no author tools executed; no Creator, browser or device work.', 'scope': 'Packaged raster sources, night 1024 fallback, meta/preset declarations and theoretical memory only.'},
    'file_count': len(files),
    'expected_original_sources': {k: {'expected_sha256': v, 'matching_files_in_package': [p for p,s in all_hashes.items() if s == v], 'independent_original_pixel_check': 'blocked: source absent' if v not in all_hashes.values() else 'available'} for k,v in expected_sources.items()},
    'raster_inventory': images,
    'built_gpu_texture_artifacts': [str(p.relative_to(ROOT)) for p in files if p.suffix.lower() in ('.astc','.ktx','.ktx2','.pvr','.pkm')],
    'night1024': {
        'sha256': raw1024_sha, 'expected_sha256': expected1024, 'hash_matches': raw1024_sha == expected1024,
        'actual_size': actual_size, 'actual_mode': actual_mode, 'file_bytes': (ROOT/'runtime/textures/tex_meadow_sky_night_1024x512.png').stat().st_size,
        'horizonV': .857, 'horizonV_times_height': .857*h, 'first_texel_center_after_horizon_row_zero_based': first_center,
        'checked_lower_rows_zero_based_inclusive': [lower_start,511], 'lower_pixel_count': len(lower)*w,
        'lower_rgb': summary(lower),
        'lower_max_row_mean_deviation_from_whole_lower_mean_per_channel': np.max(np.abs(row_means-lower.mean(axis=(0,1))),axis=0).tolist(),
        'lower_max_row_mean_deviation_from_whole_lower_mean': float(np.abs(row_means-lower.mean(axis=(0,1))).max()),
        'lower_max_pixel_deviation_from_own_column_median': float(np.abs(lower-col_medians).max()),
        'lower_max_vertical_pixel_step': float(np.abs(np.diff(lower,axis=0)).max()),
        'lower_max_horizontal_pixel_step': float(np.abs(np.diff(lower,axis=1)).max()),
        'lower_identical_all_pixels': bool(np.all(lower == lower[0,0])),
        'lower_unique_rgb_triplets': int(len(np.unique(lower.reshape(-1,3),axis=0))),
        'lower_unique_row_mean_rgb': int(len(np.unique(row_means,axis=0))),
        'lower_mean_column_range_rgb': np.ptp(lower.mean(axis=0),axis=0).tolist(),
        'row438_rgb': summary(a[438]), 'row439_rgb': summary(a[439]),
        'row438_to439_mean_luminance_step_abs': float(abs(luma(a[439]).mean()-luma(a[438]).mean())),
        'row438_to439_max_pixel_channel_step': float(np.abs(a[439]-a[438]).max()),
        'whole_image_left_right_seam_mean_abs_channel_delta': float(np.abs(a[:,0]-a[:,-1]).mean()),
        'lower_left_right_seam_mean_abs_channel_delta': float(np.abs(lower[:,0]-lower[:,-1]).mean()),
        'lower_adjacent_column_mean_abs_channel_delta': float(np.abs(np.diff(lower,axis=1)).mean()),
        'flatness_interpretation': 'Vertically near-flat horizon continuation with <=1 code-value deviation from each column median. Not a literally identical RGB fill: horizontal colour variation and dither remain.',
        'source_derivation_regeneration_stars_and_dither_retention': 'not independently verifiable without original 2048 night image; packaged author reports and comparison panels are not source files',
        'visual_review': 'Original packaged 1024 PNG opened with view_image; dark-to-blue night sky, stars and clouds visible; lower strip looks vertically flat. This is not Creator rendering, GPU compression or device visual validation.'
    },
    'meta_templates': metas,
    'runtime_paths': paths,
    'compression_effectiveness': {'night1024_declares_gpu_compression_disabled': True, 'night1024_declares_mipfilter_none': True, 'day_declares_ASTC6x6_thorough_with_JPG_fallback': True, 'night2048_declares_ASTC4x4_thorough_with_PNG_fallback': True, 'source_png_is_losslessly_compressed_file': True, 'project_imported_or_built_proof': False, 'reason': 'Package holds separate hand-authored .meta and preset templates; README line 446 states they have not been imported in Creator. No project settings or built texture outputs are included.'},
    'memory_estimates_not_measurements': {
        'night1024_RGB8_no_mips_bytes': w*h*3,
        'night1024_RGBA8_no_mips_bytes': w*h*4,
        'night1024_RGBA8_all_mips_exact_bytes': exact_mip_pixels(w,h)*4,
        'night2048_RGBA8_no_mips_bytes': 2048*1024*4,
        'night2048_ASTC4x4_no_mips_payload_bytes': ((2048+3)//4)*((1024+3)//4)*16,
        'night2048_ASTC4x4_file_with_16byte_header_bytes': ((2048+3)//4)*((1024+3)//4)*16+16,
        'actual_upload_format_gpu_memory_cpu_peak_or_download_behavior': 'not measured; project build and device verification required'
    },
    'limitations': ['2048 DAY and NIGHT originals absent: cannot verify original image hashes by asset bytes, rows 878-1023, source-colour measurements, or deterministic regeneration.', '1024 star-retention, source-relative dither-retention and original-vs-fallback comparisons remain author claims.', 'Template syntax/path consistency does not validate Creator import, compression-preset application, scene/material wiring, runtime selected asset, or real device memory.', 'The lower strip meets near-flat-with-dither evidence, not exact single-RGB strict uniformity.']
}
OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'output':str(OUT),'files':len(files),'runtime_images':[i['path'] for i in images if i['path'].startswith('runtime/')],'night1024':result['night1024'],'runtime_paths':paths,'memory':result['memory_estimates_not_measurements']},ensure_ascii=False,indent=2))
