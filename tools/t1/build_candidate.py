#!/usr/bin/env python3
"""可复现地生成 T1 候选包（不写入任何工程，只写 candidates/ 目录）。
用法: python3 tools/t1/build_candidate.py <repo-root> <out-dir> [baseline|near]
- baseline（默认）: repo-root = baseline 1ef9f1d 工作树 → variants/baseline-l123 / baseline-l12
- near:              repo-root = near 41fabe7 工作树     → variants/near-l123 / near-l12
- 每个目标有自己独立的精确前置集合（不放宽、不合并成"任一可接受"）；l123 与 l12 互斥。"""
import sys, json, hashlib, pathlib, shutil, subprocess, tempfile
H = lambda b: hashlib.sha256(b).hexdigest()
repo, out = pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2]).resolve()
TARGET = sys.argv[3] if len(sys.argv) > 3 else 'baseline'; assert TARGET in ('baseline', 'near'), TARGET
here = pathlib.Path(__file__).resolve().parent; up = here / 'src/upstream-near-hud'
S = 'creator-build-project/assets/scripts'
BASELINE = {  # 精确基线前置（baseline 1ef9f1d）；不放宽
    f'{S}/WorldIntegrationBoot.ts': '4b4be7ab333b0f5263390e6a73a04e3ea75ef1bf6ca3143560ebfb226a3cf08e',
    f'{S}/world-r1/WorldFlowComponent.ts': '2aba051baabd4e79c77cd6655f6a7ea588d28741223253025eb3bbade061d1a5',
    f'{S}/world-r2/IslandJourneyOverlay.ts': 'aae6157ce78918e0481dceb61c731ae5fb3bdff6c9a41e81faaa91da23e8d6a9'}
DEPS = [f'{S}/world-r1/WorldFlowCore.ts', f'{S}/world-r1/FirstsliceRoutes.ts', f'{S}/world-r1/FirstsliceFacts.ts', f'{S}/world-r1/RegionCameraData.ts', f'{S}/world-r1/CameraPose.ts', f'{S}/world-r1/RoomLook.ts', f'{S}/RoomExploreOverlay.ts', f'{S}/WarmButton.ts', f'{S}/world-r2/WorldNativeComposition.ts', f'{S}/audio/GameAudio.ts', f'{S}/WorldIntegrationBoot.ts.meta', f'{S}/world-r1/WorldFlowComponent.ts.meta', f'{S}/world-r2/IslandJourneyOverlay.ts.meta', f'{S}/world-r2.meta', 'creator-build-project/assets/bundles/region_island/combined_visual_m.glb']
EXPECT_DEP = {f'{S}/world-r1/WorldFlowCore.ts': '0d6a4d40f58c108adf93dbb1ebf8b47c2d757d5812284f6e441f5fe58468ec7d', f'{S}/world-r1/FirstsliceRoutes.ts': 'a3c4c1e2cc11b524dd34288560ff0cd306d419bc9f7aa7fc5e08cca307575fd9', 'creator-build-project/assets/bundles/region_island/combined_visual_m.glb': '231e2987dcab28136fb38e495d85beaa45966fba7ac18aca1932ad6b6054de5b'}
# near 41fabe7：独立的精确前置集合。三个被改文件的前置与 baseline 字节相同（near 未改它们），
# 依赖里 WorldFlowCore / FirstsliceRoutes / FirstsliceFacts / GLB 是 near 自己的值。
NEAR = dict(BASELINE)
EXPECT_DEP_NEAR = {f'{S}/world-r1/WorldFlowCore.ts': 'c5cd721f94351c05b2ee80eb5ab56456398b57f41af31d461c990006aedf0558', f'{S}/world-r1/FirstsliceRoutes.ts': '8272f92591d96fb10aebb1052ad40c09e8211bf056c2bfc5231eb47871fdbbbb', f'{S}/world-r1/FirstsliceFacts.ts': '290bbd4294d176ba97cab41b2f04ae4c9f3ea832dcad5bc24d5cd1fb062141c7', 'creator-build-project/assets/bundles/region_island/combined_visual_m.glb': '77bff8b3cb33c92a43cb02a4ad00f0f8e65f07e07052b9c870bea171194a9748'}
CFG = {'baseline': dict(prereq=BASELINE, dep=EXPECT_DEP, commit='1ef9f1d1f784293209eff158c15479e04327deaf', prefix='baseline'),
       'near': dict(prereq=NEAR, dep=EXPECT_DEP_NEAR, commit='41fabe75fbc652a1ecdb48bcc9f8dea982c714a2', prefix='near')}[TARGET]
BASELINE = CFG['prereq']
for rel, sha in {**CFG['prereq'], **CFG['dep']}.items():
    assert H((repo / rel).read_bytes()) == sha, TARGET + ' mismatch: ' + rel
# Boot: 将 near-hud 冻结 Boot 的变更集移植到 baseline Boot（唯一上下文差异在 :164，HUD 补丁）
with tempfile.TemporaryDirectory() as t:
    t = pathlib.Path(t); (t / 'a').write_bytes((up / 'before/WorldIntegrationBoot.ts').read_bytes()); (t / 'b').write_bytes((up / 'after/WorldIntegrationBoot.ts').read_bytes())
    d = subprocess.run(['diff', '-u', str(t / 'a'), str(t / 'b')], capture_output=True).stdout; (t / 'd').write_bytes(d)
    (t / 'base').write_bytes((repo / f'{S}/WorldIntegrationBoot.ts').read_bytes())
    subprocess.run(['patch', '-s', '-F1', '-o', str(t / 'boot'), str(t / 'base'), str(t / 'd')], check=True)
    boot = (t / 'boot').read_bytes()
    a = subprocess.run(['diff', str(t / 'a'), str(t / 'b')], capture_output=True).stdout; b = subprocess.run(['diff', str(t / 'base'), str(t / 'boot')], capture_output=True).stdout
    assert a == b, 'Boot change set differs from frozen near-hud change set'
common = {f'{S}/WorldIntegrationBoot.ts': boot,
          f'{S}/world-r1/WorldFlowComponent.ts': (up / 'after/world-r1/WorldFlowComponent.ts').read_bytes(),
          f'{S}/world-r2/IslandJourneyOverlay.ts': (up / 'after/world-r2/IslandJourneyOverlay.ts').read_bytes(),
          f'{S}/world-r2/IslandHomeInteraction.ts.meta': (up / 'after/world-r2/IslandHomeInteraction.ts.meta').read_bytes()}
# Component / Overlay 前置与冻结 near-hud 前置字节一致 → after 原样沿用
for rel in [f'{S}/world-r1/WorldFlowComponent.ts', f'{S}/world-r2/IslandJourneyOverlay.ts']:
    assert (up / 'before' / rel[len(S) + 1:]).read_bytes() == (repo / rel).read_bytes()
if out.exists(): shutil.rmtree(out)
order = [f'{S}/WorldIntegrationBoot.ts', f'{S}/world-r1/WorldFlowComponent.ts', f'{S}/world-r2/IslandJourneyOverlay.ts', f'{S}/world-r2/IslandHomeInteraction.ts', f'{S}/world-r2/IslandHomeInteraction.ts.meta']
summary = {}
P = CFG['prefix']
for name, src in [(f'{P}-l123', 'IslandHomeInteraction.L123.ts'), (f'{P}-l12', 'IslandHomeInteraction.L12.ts')]:
    v = out / 'variants' / name; files = dict(common); files[f'{S}/world-r2/IslandHomeInteraction.ts'] = (here / 'src' / src).read_bytes()
    entries = []
    for rel in order:
        before = (repo / rel).read_bytes() if rel in BASELINE else None
        if before is not None: (v / 'before' / rel).parent.mkdir(parents=True, exist_ok=True); (v / 'before' / rel).write_bytes(before)
        (v / 'after' / rel).parent.mkdir(parents=True, exist_ok=True); (v / 'after' / rel).write_bytes(files[rel])
        entries.append({'path': rel, 'before_sha256': H(before) if before is not None else None, 'after_sha256': H(files[rel]), 'before_bytes': len(before) if before else 0, 'after_bytes': len(files[rel])})
    deps = [{'path': d, 'sha256': H((repo / d).read_bytes())} for d in DEPS]
    excl = ['T1-lighthouse-return-baseline-l123' if name == 'baseline-l12' else 'T1-lighthouse-return-baseline-l12', 'island-lighthouse-return-room-hud', 'island-lighthouse-return-near-hud']
    if TARGET == 'near': excl = [f'T1-lighthouse-return-near-l12' if name.endswith('l123') else 'T1-lighthouse-return-near-l123', 'T1-lighthouse-return-baseline-l123', 'T1-lighthouse-return-baseline-l12', 'island-lighthouse-return-room-hud', 'island-lighthouse-return-near-hud']
    m = {'name': f'T1-lighthouse-return-{name}', 'task_id': 'T1', 'baseline_commit': CFG['commit'], 'status': 'HOLD: isolated validation only; not for production install',
         'mutually_exclusive_with': excl,
         'files': entries, 'dependencies': deps, 'native_status': 'NOT_RUN', 'new_media_bytes': 0,
         'production_delta_bytes': sum(e['after_bytes'] - e['before_bytes'] for e in entries)}
    (v / 'manifest.json').write_text(json.dumps(m, indent=2, ensure_ascii=False) + '\n')
    shutil.copy2(here / 'apply_v2.py', v / 'apply.py')
    with tempfile.TemporaryDirectory() as t:
        t = pathlib.Path(t); (t / 'a').mkdir(); (t / 'b').mkdir()
        for rel in order:
            if (v / 'before' / rel).exists(): (t / 'a' / rel).parent.mkdir(parents=True, exist_ok=True); shutil.copy2(v / 'before' / rel, t / 'a' / rel)
            (t / 'b' / rel).parent.mkdir(parents=True, exist_ok=True); shutil.copy2(v / 'after' / rel, t / 'b' / rel)
        p = subprocess.run(['git', 'diff', '--no-index', '--no-color', '--src-prefix=', '--dst-prefix=', 'a', 'b'], cwd=t, capture_output=True).stdout  # 无时间戳 → 可逐字节复现
        (v / 'lighthouse-return.patch').write_bytes(p)
    summary[name] = {e['path'].split('/')[-1]: e['after_sha256'] for e in entries} | {'production_delta_bytes': m['production_delta_bytes']}
shutil.copy2(here / 'verify_t1.py', out / 'verify_t1.py'); shutil.copy2(here / ('CANDIDATE-README.md' if TARGET == 'baseline' else 'CANDIDATE-README-near.md'), out / 'README.md')
sums = sorted(p for p in out.rglob('*') if p.is_file() and p.name != 'SHA256SUMS')
(out / 'SHA256SUMS').write_text(''.join(f'{H(p.read_bytes())}  {p.relative_to(out)}\n' for p in sums))
print(json.dumps(summary, indent=1))
