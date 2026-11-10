/**
 * Coast scene loader, compatible with the f9c5656a CoastSceneLoader contract.
 * assetManager loads layout + models/*.glb prefabs + both coast palettes.
 * Every planned non-palm instance is instantiate()'d from the GLB node (baked reuse from coast_reuse.glb src names)
 * and receives resolveMaterial's material on each primitive slot. Palette meshes clone that material and swap mainTexture.
 * Island palms are instantiate()'d from resolveReuse and keep the island rig's own materials.
 * Class identity accepts a mount. Empty nativeUrl is legal for Prefab and JsonAsset. That acceptance is not a Creator render pass:
 * engineEvidence stays unavailable. An explicit mock label is rejected. Duck-typed constructor names are not assets.
 */
import { assetManager, Asset, gfx, instantiate, isValid, JsonAsset, Material, MaterialInstance, Mesh, MeshRenderer, Node, Prefab, renderer, Texture2D, Vec3, Vec4 } from 'cc';
/** Creator 3.8.8 runtime: MaterialInstance is only exported as cc.renderer.MaterialInstance (top-level import is undefined in the
 *  WeChat build: "h is not a constructor"). Top-level first keeps the node harness doubles working. */
const MaterialInstanceCtor: typeof MaterialInstance = ((MaterialInstance as unknown) || (renderer as any)?.MaterialInstance) as typeof MaterialInstance;
import { coastBoardKitFromFlag } from './BoardProjection';
import { COAST_BUNDLE, COAST_LAYOUT_PATH, COAST_PALETTE_PATH, COAST_PALETTE_SAND_PATH, COAST_MODELS_DIR, COAST_REUSE_SOURCES, COAST_ROOT, coastInstances, type CoastLayout, type CoastInstance, type MatKind } from './CoastSceneLayout';

export const QF_COAST = '[QF_COAST]';
export type CoastMaterialKey = Readonly<{ mesh: string; kind: MatKind; alpha: number; emit: boolean; palette: boolean }>;
export type CoastSceneOptions = Readonly<{
  resolveReuse: (name: string) => Node | null;
  resolveMaterial: (key: CoastMaterialKey) => Material | null;
  cancelled: () => boolean;
  deadlineMs?: number;
  kitOn?: () => boolean;
}>;
export type CoastEngineEvidence = 'unavailable' | 'loaded';
export type CoastSceneHandle = Readonly<{
  root: Node;
  placed: number;
  reusePlaced: number;
  planned: number;
  geometryCreated: number;
  materialAssigned: number;
  /** Held assets are the real Prefab/JsonAsset/Texture2D classes and meshes are Mesh. Empty nativeUrl is accepted. Not a render pass. */
  typesAccepted: boolean;
  /** Not derived from class shape. Creator has not reported a rendered frame. */
  engineLoaded: false;
  engineEvidence: CoastEngineEvidence;
  errors: readonly string[];
  dispose(): void;
}>;
export type CoastWorld = Node | Readonly<{ sceneRoot?: Node | null; node?: Node | null; root?: Node | null }>;

const err = (msg: string) => { console.error(QF_COAST + ' ' + msg); return msg; };
const deadline = <T>(p: Promise<T>, ms: number) => { let t: ReturnType<typeof setTimeout> | undefined; return Promise.race([p, new Promise<never>((_, no) => { t = setTimeout(() => no(Error('coast-asset-timeout')), ms); })]).finally(() => clearTimeout(t)); };
const loadBundle = () => new Promise<import('cc').AssetManager.Bundle>((ok, no) => { const b = assetManager.getBundle?.(COAST_BUNDLE); if (b) return ok(b); assetManager.loadBundle(COAST_BUNDLE, (e, x) => e || !x ? no(e || Error('no bundle')) : ok(x)); });
const loadJson = (b: import('cc').AssetManager.Bundle) => new Promise<JsonAsset>((ok, no) => b.load(COAST_LAYOUT_PATH, JsonAsset, (e, a) => e || !a ? no(e || Error('no layout')) : ok(a)));
const loadTex = (b: import('cc').AssetManager.Bundle, path = COAST_PALETTE_PATH) => new Promise<Texture2D>((ok, no) => b.load(path, Texture2D, (e, a) => e || !a ? no(e || Error('no ' + path)) : ok(a)));
const loadPrefabs = (b: import('cc').AssetManager.Bundle) => new Promise<Prefab[]>((ok, no) => b.loadDir(COAST_MODELS_DIR, Prefab, (e, l) => e ? no(e) : ok(l || [])));
function worldNode(w: CoastWorld | null | undefined): Node | null { if (!w) return null; if (w instanceof Node) return w; const o = w as { sceneRoot?: Node | null; node?: Node | null; root?: Node | null }; return o.sceneRoot || o.node || o.root || null; }
type Rend = MeshRenderer & { mesh?: { struct?: { primitives?: unknown[] }; label?: string; hash?: number; renderingSubMeshes?: unknown[]; constructor?: { name?: string } }; setMaterial?: (m: Material, index: number) => void; getMaterial?: (index: number) => Material | null; shadowCastingMode?: number; receiveShadow?: number | boolean };
function findDeep(n: Node, name: string): Node | null { if (n.name === name && n.getComponent(MeshRenderer)) return n; for (const c of n.children) { const r = findDeep(c, name); if (r) return r; } return null; }
function setTRS(n: Node, i: CoastInstance) { n.setPosition(i.position[0], i.position[1], i.position[2]); n.setRotationFromEuler(i.eulerDeg[0], i.eulerDeg[1], i.eulerDeg[2]); n.setScale(i.scale, i.scale, i.scale); }
function geometryOf(n: Node): { renderer: Rend; mesh: NonNullable<Rend['mesh']> } | null {
  const stack = [n];
  while (stack.length) {
    const cur = stack.pop()!;
    const r = cur.getComponent(MeshRenderer) as Rend | null;
    if (r && r.mesh) return { renderer: r, mesh: r.mesh };
    for (const c of cur.children) stack.push(c);
  }
  return null;
}
function assignMaterial(r: Rend, m: Material): boolean {
  if (typeof r.setMaterial !== 'function') return false;
  const slots = Array.isArray(r.mesh?.struct?.primitives) && r.mesh!.struct!.primitives!.length > 0 ? r.mesh!.struct!.primitives!.length : 1;
  // A MaterialInstance goes into the instance slot (setMaterialInstance); writing it into a shared slot is Cocos error 12012.
  const ri = r as Rend & { setMaterialInstance?: (m: Material, index: number) => void; getRenderMaterial?: (index: number) => Material | null };
  const asInstance = !!MaterialInstanceCtor && m instanceof MaterialInstanceCtor && typeof ri.setMaterialInstance === 'function';
  try { for (let s = 0; s < slots; s++) { if (asInstance) ri.setMaterialInstance!(m, s); else r.setMaterial(m, s); } } catch { return false; }
  const back = asInstance && typeof ri.getRenderMaterial === 'function' ? ri.getRenderMaterial(0) : (typeof r.getMaterial === 'function' ? r.getMaterial(0) : r.sharedMaterials?.[0]);
  return back === m;
}
const MOCK = 'mock-not-cocos';
function explicitMock(value: unknown): boolean { return !!value && (value as { label?: string }).label === MOCK; }
/** Real Mesh class. A constructor-name stand-in, a labeled mock, or a clone count is not a mesh. */
export function coastMeshTypeAccepted(mesh: unknown): boolean {
  return !!mesh && !explicitMock(mesh) && mesh instanceof Mesh;
}
/**
 * Real Prefab, JsonAsset, or Texture2D. Creator leaves nativeUrl '' when the asset has no separate native file
 * (the usual Prefab and JsonAsset case). nativeUrl is not read. A labeled mock fails even if it is a real instance.
 */
export function coastAssetTypeAccepted(asset: unknown): boolean {
  return !!asset && !explicitMock(asset) && (asset instanceof Prefab || asset instanceof JsonAsset || asset instanceof Texture2D);
}

export async function loadCoastScene(world: CoastWorld, opts: CoastSceneOptions): Promise<CoastSceneHandle | null> {
  if (!(opts?.kitOn ?? coastBoardKitFromFlag)()) return null;
  const parent = worldNode(world);
  const miss = [!parent && 'world node', typeof opts?.resolveReuse !== 'function' && 'resolveReuse', typeof opts?.resolveMaterial !== 'function' && 'resolveMaterial', typeof opts?.cancelled !== 'function' && 'cancelled'].filter(Boolean);
  if (miss.length) { err('scene not mounted: missing ' + miss.join(', ')); return null; }
  const ms = opts.deadlineMs ?? 20000, held: Asset[] = []; let root: Node | null = null, lib: Node | null = null; const clones: Material[] = [];
  const release = () => { for (const c of clones.splice(0)) if (isValid(c)) c.destroy(); if (lib && isValid(lib)) lib.destroy(); lib = null; if (root && isValid(root)) root.destroy(); root = null; for (const a of held.splice(0)) a.decRef(); };
  const gone = () => { if (!opts.cancelled()) return false; console.warn(QF_COAST + ' scene mount cancelled (teardown/region change)'); release(); return true; };
  try {
    const b = await deadline(loadBundle(), ms); if (gone()) return null;
    const [json, prefabs, tex, sand] = await Promise.all([deadline(loadJson(b), ms), deadline(loadPrefabs(b), ms * 1.5), deadline(loadTex(b), ms), deadline(loadTex(b, COAST_PALETTE_SAND_PATH), ms)]);
    json.addRef(); held.push(json); tex.addRef(); held.push(tex); sand.addRef(); held.push(sand); for (const p of prefabs) { p.addRef(); held.push(p); } if (gone()) return null;
    const L = json.json as CoastLayout;
    const plannedList = coastInstances(L);
    const ordinaryExpected = plannedList.filter((i) => !(i.reuse && COAST_REUSE_SOURCES[i.mesh]?.from === 'island')).length;
    root = new Node(COAST_ROOT.name); root.active = false;
    root.setPosition(COAST_ROOT.position[0], COAST_ROOT.position[1], COAST_ROOT.position[2]); root.setRotationFromEuler(0, COAST_ROOT.yawDeg, 0); root.setScale(COAST_ROOT.scale, COAST_ROOT.scale, COAST_ROOT.scale);
    lib = new Node('coast_glb_templates'); for (const p of prefabs) lib.addChild(instantiate(p));
    const tpl = new Map<string, Node | null>(), mats = new Map<string, Material | null>(), errors: string[] = [];
    let placed = 0, reusePlaced = 0, geometryCreated = 0, materialAssigned = 0;
    const createdMeshes: unknown[] = [];
    for (const i of plannedList) {
      let t = tpl.get(i.mesh);
      if (t === undefined) {
        const rs = i.reuse ? COAST_REUSE_SOURCES[i.mesh] : undefined;
        if (i.reuse && !rs) { t = null; errors.push(err('reuse name not in COAST_REUSE_SOURCES: ' + i.mesh + ' (not mounted)')); }
        else if (rs && rs.from === 'region_coast') { t = findDeep(lib, rs.src); if (!t) errors.push(err('reuse unresolved: ' + i.mesh + ' -> ' + rs.src + ' missing in models/coast_reuse.glb (' + rs.count + ' instances not mounted)')); }
        else if (rs) { try { t = opts.resolveReuse(i.mesh); } catch { t = null; } if (!t || !isValid(t)) { t = null; errors.push(err('reuse unresolved: ' + i.mesh + ' (' + rs.count + ' instances not mounted)')); } }
        else { t = findDeep(lib, i.mesh); if (!t) errors.push(err('mesh missing in models/*.glb: ' + i.mesh)); }
        tpl.set(i.mesh, t);
      }
      if (!t) continue;
      const rs = i.reuse ? COAST_REUSE_SOURCES[i.mesh] : undefined, baked = rs?.from === 'region_coast';
      if (i.reuse && !baked) {
        const n = instantiate(t); n.name = i.mesh; n.active = true; setTRS(n, i); root.addChild(n); reusePlaced++; continue;
      }
      const ptex = rs?.tint === 'sand' ? sand : tex;
      const key: CoastMaterialKey = { mesh: i.mesh, kind: baked ? 'std' : i.kind, alpha: baked ? 1 : i.alpha, emit: baked ? false : i.kind === 'unlit', palette: !!(baked || i.palette) };
      const mk = coastMaterialCacheKey(key, key.palette && rs?.tint === 'sand' ? 'sand' : key.palette ? 'coast' : 'source');
      let m = mats.get(mk);
      if (m === undefined) {
        let base: Material | null = null;
        try { base = opts.resolveMaterial(key); } catch { base = null; }
        const finished = coastFinishMaterial(base, key, key.palette ? ptex : null, clones);
        m = finished.material; if (!m) errors.push(err(finished.reason + ' (' + i.mesh + ' not mounted)'));
        mats.set(mk, m);
      }
      if (!m) continue;
      let n = instantiate(t), r = n.getComponent(MeshRenderer) as Rend | null;
      if (!r || typeof r.setMaterial !== 'function') { errors.push(err('geometry missing on ' + i.mesh + ': instantiate did not yield MeshRenderer.setMaterial')); n.destroy(); continue; }
      if (!assignMaterial(r, m)) { errors.push(err('material not assigned on ' + i.mesh)); n.destroy(); continue; }
      materialAssigned++;
      if (baked) {
        const w = new Node(i.mesh); n.setPosition(0, rs!.norm ? rs!.norm.offsetY : 0, 0); n.setRotationFromEuler(0, 0, 0); const k = rs!.norm ? rs!.norm.scale : 1; n.setScale(k, k, k); n.active = true; w.addChild(n); n = w;
      } else n.name = i.mesh;
      const geo = geometryOf(n);
      if (!geo) { errors.push(err('geometry missing on ' + i.mesh)); n.destroy(); materialAssigned--; continue; }
      geometryCreated++; createdMeshes.push(geo.mesh);
      r.shadowCastingMode = i.castShadow ? 1 : 0; r.receiveShadow = i.receiveShadow ? 1 : 0;
      setTRS(n, i); root.addChild(n); if (baked) reusePlaced++; else placed++;
    }
    lib.destroy(); lib = null;
    if (gone()) return null;
    if (errors.length || geometryCreated !== ordinaryExpected || materialAssigned !== ordinaryExpected) {
      err('scene not mounted: planned=' + plannedList.length + ' geometry=' + geometryCreated + ' materials=' + materialAssigned + ' ordinary=' + ordinaryExpected + (errors[0] ? ' first=' + errors[0] : ''));
      release(); return null;
    }
    if (!isValid(parent!)) { err('scene not mounted: world node destroyed'); release(); return null; }
    const typesAccepted = createdMeshes.length === ordinaryExpected && createdMeshes.every(coastMeshTypeAccepted) && held.length > 0 && held.every(coastAssetTypeAccepted);
    const shown = root; parent!.addChild(shown); shown.active = true; root = null;
    const mine = held.splice(0), mineMats = clones.splice(0); let done = false;
    const handle: CoastSceneHandle = {
      root: shown, placed, reusePlaced, planned: plannedList.length, geometryCreated, materialAssigned, typesAccepted, engineLoaded: false, engineEvidence: 'unavailable', errors,
      dispose() { if (done) return; done = true; if (isValid(shown)) shown.destroy(); for (const c of mineMats) if (isValid(c)) c.destroy(); for (const a of mine) a.decRef(); },
    };
    return handle;
  } catch (e) { err('scene mount failed: ' + String((e as Error)?.message ?? e)); release(); return null; }
}

/** Property name of the base-colour texture on M_env_palette. */
export const COAST_MAIN_TEXTURE = 'mainTexture';
/**
 * builtin-standard v3.8.8 (editor/assets/effects/builtin-standard.effect) marks mainColor and emissive `linear: true`
 * and leaves emissiveScale without that flag. The fragment is emissive.rgb * emissiveScaleParam.xyz, unless USE_EMISSIVE_MAP
 * replaces emissive.rgb. The effect default emissive is (0,0,0,1).
 * Upload is material.ts _uploadProperty: if pass.properties[name].linear, SRGBToLinear (pipeline-funcs.ts, rgb = c*c, not pow 2.2)
 * then v4_1.w = v4.w. setProperty stores the authored value in _props; Pass.getUniform is the converted block.
 */
export const COAST_EMISSIVE: readonly [number, number, number, number] = [1, 0.72, 0.28, 1];
/** Not a linear:true property. A component other than 0 or 1 shows the upload did not square it. */
export const COAST_EMISSIVE_SCALE: readonly [number, number, number] = [1, 0.8, 0.5];
type MatPass = { getHandle: (name: string) => unknown; getUniform?: (handle: unknown, out: Vec4) => void; defines?: Record<string, unknown>; rasterizerState?: { cullMode?: number }; depthStencilState?: { depthTest?: boolean; depthWrite?: boolean; depthFunc?: number }; blendState?: { targets?: { blend?: boolean; blendSrc?: number; blendDst?: number }[] } };
type Finish = { material: Material | null; reason: string };
export function coastMaterialCacheKey(key: CoastMaterialKey, tint: string): string {
  return key.kind + '|' + key.alpha + '|' + (key.emit ? 1 : 0) + '|' + (key.palette ? 1 : 0) + '|' + tint;
}
function passOf(m: Material): MatPass | null {
  const passes = (m as Material & { passes?: MatPass[] }).passes;
  return passes && passes[0] ? passes[0] : null;
}
function readUniform(pass: MatPass, name: string): Vec4 | null {
  if (!pass || typeof pass.getHandle !== 'function' || typeof pass.getUniform !== 'function') return null;
  const handle = pass.getHandle(name);
  if (!handle) return null;
  const out = new Vec4();
  try { pass.getUniform(handle, out); } catch { return null; }
  return out;
}
/** Authored sRGB property → GPU uniform. Matches v3.8.8 SRGBToLinear (c*c) plus _uploadProperty keeping W. */
function authoredToLinearUniform(authored: Vec4, out: Vec4): void {
  out.x = authored.x * authored.x;
  out.y = authored.y * authored.y;
  out.z = authored.z * authored.z;
  out.w = authored.w;
}
function close4(a: Vec4, b: Vec4): boolean {
  return Math.abs(a.x - b.x) <= 1e-4 && Math.abs(a.y - b.y) <= 1e-4 && Math.abs(a.z - b.z) <= 1e-4 && Math.abs(a.w - b.w) <= 1e-4;
}
function coastFinishMaterial(base: Material | null, key: CoastMaterialKey, tex: Texture2D | null, owned: Material[]): Finish {
  if (!base || !isValid(base)) return { material: null, reason: 'material unavailable for ' + key.mesh + ' alpha=' + key.alpha + ' emit=' + key.emit };
  const parent = new Material();
  try { parent.copy(base); } catch { parent.destroy(); return { material: null, reason: 'material copy failed for ' + key.mesh }; }
  if (key.palette) {
    const p = passOf(parent);
    if (!tex || !p || !p.getHandle(COAST_MAIN_TEXTURE)) { parent.destroy(); return { material: null, reason: 'coast_palette swap failed on ' + (base.name || '?') + ': property ' + COAST_MAIN_TEXTURE + ' missing' }; }
    try { parent.setProperty(COAST_MAIN_TEXTURE, tex); } catch { parent.destroy(); return { material: null, reason: 'coast_palette setProperty threw for ' + key.mesh }; }
    let back: unknown = null; try { back = parent.getProperty(COAST_MAIN_TEXTURE); } catch { back = null; }
    if (back !== tex) { parent.destroy(); return { material: null, reason: 'coast_palette read-back mismatch for ' + key.mesh }; }
  }
  if (!(key.alpha < 1) && !key.emit) { owned.push(parent); return { material: parent, reason: '' }; }
  // v3.8.8 Material.overridePipelineStates is warnID(16371) and does not change the pass. States live on MaterialInstance → PassInstance.
  let inst: MaterialInstance;
  try { inst = new MaterialInstanceCtor({ parent }); } catch (e) { parent.destroy(); return { material: null, reason: 'MaterialInstance failed for ' + key.mesh + ' (' + String((e as Error)?.message || e) + ')' }; }
  if (!inst || inst === (parent as unknown) || !(inst instanceof MaterialInstanceCtor)) { inst?.destroy(); parent.destroy(); return { material: null, reason: 'MaterialInstance was not isolated for ' + key.mesh }; }
  if (key.alpha < 1) {
    const alpha = applyAlpha(inst, key.alpha);
    if (!alpha.ok) { inst.destroy(); parent.destroy(); return { material: null, reason: alpha.reason + ' for ' + key.mesh }; }
  }
  if (key.emit) {
    const emit = applyEmissive(inst);
    if (!emit.ok) { inst.destroy(); parent.destroy(); return { material: null, reason: emit.reason + ' for ' + key.mesh }; }
  }
  owned.push(inst, parent);
  return { material: inst, reason: '' };
}
function applyAlpha(inst: MaterialInstance, alpha: number): { ok: boolean; reason: string } {
  const pass = passOf(inst);
  if (!pass || !pass.getHandle('mainColor') || typeof pass.getUniform !== 'function') return { ok: false, reason: 'mainColor uniform missing' };
  // getProperty is the authored sRGB value. The pass uniform is already linear. Feeding the uniform back into setProperty squares it again.
  const requested = inst.getProperty('mainColor') as Vec4 | null;
  const src = requested && typeof requested.x === 'number' ? requested : new Vec4(1, 1, 1, 1);
  try { inst.setProperty('mainColor', new Vec4(src.x, src.y, src.z, alpha)); } catch { return { ok: false, reason: 'mainColor setProperty threw' }; }
  const depth = pass.depthStencilState || {};
  try {
    inst.overridePipelineStates({
      rasterizerState: { cullMode: pass.rasterizerState?.cullMode ?? gfx.CullMode.BACK },
      depthStencilState: { depthTest: depth.depthTest !== false, depthWrite: false, depthFunc: depth.depthFunc ?? gfx.ComparisonFunc.LESS },
      blendState: { targets: [{ blend: true, blendEq: gfx.BlendOp.ADD, blendSrc: gfx.BlendFactor.SRC_ALPHA, blendDst: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA, blendAlphaEq: gfx.BlendOp.ADD, blendSrcAlpha: gfx.BlendFactor.ONE, blendDstAlpha: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA }] },
    }, 0);
  } catch { return { ok: false, reason: 'transparent overridePipelineStates threw' }; }
  const after = passOf(inst);
  const color = after ? readUniform(after, 'mainColor') : null;
  const expect = new Vec4();
  authoredToLinearUniform(new Vec4(src.x, src.y, src.z, alpha), expect);
  const target = after?.blendState?.targets?.[0];
  const cached = inst.getProperty('mainColor') as Vec4 | null;
  if (!after || !color || !cached || !close4(color, expect) || Math.abs(cached.x - src.x) > 1e-4 || Math.abs(cached.w - alpha) > 1e-4 || !target?.blend || after.depthStencilState?.depthWrite !== false || target.blendSrc !== gfx.BlendFactor.SRC_ALPHA || target.blendDst !== gfx.BlendFactor.ONE_MINUS_SRC_ALPHA) return { ok: false, reason: 'transparent read-back mismatch' };
  return { ok: true, reason: '' };
}
function applyEmissive(inst: MaterialInstance): { ok: boolean; reason: string } {
  const pass = passOf(inst);
  if (!pass || !pass.getHandle('emissive') || typeof pass.getUniform !== 'function') return { ok: false, reason: 'emissive uniform missing' };
  if (pass.defines && pass.defines.USE_EMISSIVE_MAP) {
    // SurfacesFragmentModifyEmissive replaces emissive.rgb with the map sample while this define is set.
    try { inst.recompileShaders({ USE_EMISSIVE_MAP: false }, 0); } catch { return { ok: false, reason: 'USE_EMISSIVE_MAP recompile threw' }; }
  }
  const color = COAST_EMISSIVE, scale = COAST_EMISSIVE_SCALE;
  try {
    inst.setProperty('emissive', new Vec4(color[0], color[1], color[2], color[3]));
    if (pass.getHandle('emissiveScale')) inst.setProperty('emissiveScale', new Vec3(scale[0], scale[1], scale[2]));
  } catch { return { ok: false, reason: 'emissive setProperty threw' }; }
  const after = passOf(inst);
  const got = after ? readUniform(after, 'emissive') : null;
  const gotScale = after && after.getHandle('emissiveScale') ? readUniform(after, 'emissiveScale') : null;
  const expect = new Vec4();
  authoredToLinearUniform(new Vec4(color[0], color[1], color[2], color[3]), expect);
  const cached = inst.getProperty('emissive') as Vec4 | null;
  if (!after || !got || !cached || got.x === 0 && got.y === 0 && got.z === 0) return { ok: false, reason: 'emissive uniform still black' };
  if (!close4(got, expect) || Math.abs(cached.y - color[1]) > 1e-4 || Math.abs(cached.w - color[3]) > 1e-4) return { ok: false, reason: 'emissive uniform read-back mismatch' };
  if (gotScale && (Math.abs(gotScale.x - scale[0]) > 1e-4 || Math.abs(gotScale.y - scale[1]) > 1e-4 || Math.abs(gotScale.z - scale[2]) > 1e-4)) return { ok: false, reason: 'emissiveScale uniform mismatch' };
  if (after.defines && after.defines.USE_EMISSIVE_MAP) return { ok: false, reason: 'USE_EMISSIVE_MAP still replaces emissive.rgb' };
  return { ok: true, reason: '' };
}
export function unloadCoastScene(h: CoastSceneHandle | null | undefined) { h?.dispose(); }

{ const g = globalThis as { __qfCoast?: Record<string, unknown> }; const o = g.__qfCoast || (g.__qfCoast = {}); o.loadCoastScene = loadCoastScene; o.unloadCoastScene = unloadCoastScene; }

/** Shared island material by renderer name. The loader never destroys this object. */
export function coastIslandMaterial(island: Node | null, name: string): Material | null {
  if (!island || !isValid(island)) return null;
  for (const r of island.getComponentsInChildren(MeshRenderer)) for (const m of r.sharedMaterials) if (m && m.name === name) return m;
  return null;
}
