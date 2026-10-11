import { Node, Scene, DirectionalLight, SpotLight, MeshRenderer, SkeletalAnimation,
  Material, Mesh, Texture2D, EffectAsset, Color, Vec3, Vec4, Quat, director, renderer, utils, isValid } from 'cc';

/** Cocos 3.8.8 runtime lighting. Imported assets, cameras and bones stay unchanged; lamp emission uses one owned material instance.
 * One room-only directional shadow map + one unshadowed local lamp; two steam draw calls.
 * The owner advances this after animation and disposes it before releasing the model. */
/* ---------------------------------------------------------------------------------------------
 * T5 ROOM-LIGHT API (owner: GGbot). One interface; WorldFlowCore does not drive it.
 *   setRoomLightWeight(w: number): boolean     getRoomLightWeight(): number
 *   (WorldFlowComponent passthroughs + optional WorldLease.setRoomLightWeight/getRoomLightWeight/blendRoomLight)
 * - w in [0,1], clamped. Non-finite w is rejected (returns false, nothing changes).
 * - w=0: the scene's original island light (Main Light rotation, illuminance/colour as set by day/night,
 *   ambient skyIllum/skyColor/groundAlbedo as authored); room shadow strength 0.
 *   w=1: the indoor light, assignment-for-assignment identical to the pre-T5 setView(interior=true).
 *   In between: sun rotation slerp, illuminance/colour/ambient lerp, shadowSaturation = room*w.
 * - Only meaningful while the view includes the interior (setView(interior=true), i.e. HOME or BOTH).
 *   Otherwise set returns false and get returns 0. After dispose: set false, get 0.
 * - setView(true) entering from non-interior: w := 1. setView(true) again (day/night toggle): w kept, re-applied
 *   with the new day/night endpoints. setView(false) (ISLAND/NONE via restore()): w := 0 and the original
 *   restoreSun() runs (shadow flags/size restored).
 *   The WorldFlowComponent adapter additionally forces w := 1 on every setLayers() with interior=true
 *   (HOME or BOTH), so restore()/setLayers always land on a fully defined state. To start BOTH on island
 *   light, call setLayers(BOTH) then setRoomLightWeight(0) in the same synchronous step (no frame between).
 * - Idempotent: the same w always produces the same writes; nothing accumulates.
 * - Without a driver, BOTH keeps w=1 until restore(ISLAND) sets 0: the original one-frame jump remains.
 * - hasRoomLight(): true while the rig is alive (not disposed). w=0 is "outdoors" ONLY when hasRoomLight() is true
 *   AND the world is visible: WorldFlowComponent.isWorldVisible() is false under levels/skycity/hidden/needs-resume
 *   (restore() -> setLayers(NONE); the island world stays loaded, rig alive, w=0). Consumer pattern:
 *     if (!wf || !wf.hasRoomLight() || !wf.isWorldVisible()) -> treat as indoor/silent
 *     else outdoorness = 1 - wf.getRoomLightWeight()
 * ------------------------------------------------------------------------------------------- */
export const ROOM_LIGHTING = Object.freeze({
  shadowMapSize: 1024, shadowOrthoSize: 4.1, shadowFar: 12,
  daylightScale: .60, moonlightScale: .035, ambientToMainDay: .15, ambientToMainNight: .065,
  shadowSaturationDay: .72, shadowSaturationNight: .62,
  lampRange: 3.6, lampAngle: 106, lampEdgeSoftness: .55, lampDayScale: 0, lampNightScale: .82,
  updateHz: 30, steamTextureWidth: 32, steamTextureHeight: 64,
});

type RendererState = { renderer: MeshRenderer; cast: number; receive: number };
type LampEmissionState = {
  renderer: MeshRenderer; index: number; shared: Material; instance: Material; nightScale: Vec3;
};
type FoliageMaterialState = { renderer: MeshRenderer; index: number; shared: Material; instance: Material };
type SeaDetailState = { renderer: MeshRenderer; shared: Material; instance: Material; base: Vec4; offset: Vec4 };
type TransformState = { node: Node; position: Vec3; rotation: Quat; scale: Vec3 };
type Steam = { node: Node; phase: number; color: Color; material: Material };
type SunState = {
  position: Vec3; rotation: Quat; shadowEnabled: boolean; shadowPcf: number;
  shadowBias: number; shadowNormalBias: number; shadowSaturation: number; shadowFixedArea: boolean;
  shadowNear: number; shadowFar: number; shadowOrthoSize: number; csmLevel: number;
  illuminance: number; color: Color;
};

function live(node: Node | null | undefined): node is Node { return !!node && isValid(node, true); }
function find(root: Node, name: string): Node | null {
  if (root.name === name) return root;
  for (let i = 0; i < root.children.length; i++) { const n = find(root.children[i], name); if (n) return n; }
  return null;
}
function remember(node: Node | null): TransformState | null {
  return node ? { node, position: node.position.clone(), rotation: node.rotation.clone(), scale: node.scale.clone() } : null;
}
function restore(value: TransformState | null): void {
  if (!value || !live(value.node)) return;
  value.node.setPosition(value.position); value.node.setRotation(value.rotation); value.node.setScale(value.scale);
}
function pathFrom(root: Node, child: Node): string | null {
  const parts: string[] = []; let n: Node | null = child;
  while (n && n !== root) { parts.push(n.name); n = n.parent; }
  return n === root ? parts.reverse().join('/') : null;
}

/** Pure one-time alpha rasterization. No external image, network, particle simulation or shader dependency. */
export function makeSteamPixels(width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = y / (height - 1), u = x / (width - 1);
    const center = .5 + Math.sin(v * 8.4) * .15;
    const spread = .055 + .085 * v;
    const edge = Math.exp(-Math.pow((u - center) / spread, 2) * 1.5);
    const fade = Math.sin(Math.PI * v) ** 1.3;
    const i = (y * width + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(128 * edge * fade);
  }
  return pixels;
}

export class RoomLightingRig {
  private disposed = false;
  private interior = false;
  private backdrop = false;
  private night = false;
  private paused = false;
  private time = 0;
  private accumulator = 0;
  private updates = 0;
  private sun: DirectionalLight | null = null;
  private sunState: SunState | null = null;
  private sceneShadow: { enabled: boolean; type: number; size: number } | null = null;
  private ambientIllum = 0;
  private ambientSkyColor: Vec4 | null = null;
  private ambientGroundColor: Vec4 | null = null;
  private root: Node | null = null;
  private lampNode: Node | null = null;
  private lamp: SpotLight | null = null;
  private lampBase = 0;
  private lampBinding = 'missing';
  private lampEmissions: LampEmissionState[] = [];
  private foliageMaterials: FoliageMaterialState[] = [];
  private lampEmissionNight = false;
  private lampOffScale = new Vec3();
  private socketOwner: SkeletalAnimation | null = null;
  private socket: InstanceType<typeof SkeletalAnimation.Socket> | null = null;
  private ownedSocketTarget: Node | null = null;
  private states: RendererState[] = [];
  private plant: TransformState | null = null;
  private sea: TransformState | null = null;
  private clouds: TransformState | null = null;
  private seaDetail: SeaDetailState | null = null;
  private seaDetailTime = 0;
  private steam: Steam[] = [];
  private mesh: Mesh | null = null;
  private texture: Texture2D | null = null;
  private materials: Material[] = [];
  private notices: string[] = [];
  private delta = new Quat();
  private rotation = new Quat();
  // T5: 0 = island (scene-authored) photometry, 1 = room photometry. Only meaningful while interior.
  private roomWeight = 0;
  private interiorRotation = new Quat();
  private blendRotation = new Quat();
  private islandIllum = 0;
  private islandColor = new Color(255, 255, 255, 255);
  private blendColor = new Color();
  private blendSky = new Vec4();
  private blendGround = new Vec4();
  private roomSky = new Vec4();
  private roomGround = new Vec4();
  private sunDayColor = new Color('#fff4de');
  private sunNightColor = new Color('#aebde6');
  private skyDayColor = new Color('#b4c8dd');
  private groundDayColor = new Color('#9c856d');
  private skyNightColor = new Color('#8898ba');
  private groundNightColor = new Color('#79634f');

  constructor(private scene: Scene, private model: Node, character: Node | null) {
    try {
      this.sun = scene.getChildByName('Main Light')?.getComponent(DirectionalLight) || null;
      if (this.sun) {
        const s = this.sun;
        this.sunState = { position: s.node.position.clone(), rotation: s.node.rotation.clone(),
          shadowEnabled: s.shadowEnabled, shadowPcf: s.shadowPcf, shadowBias: s.shadowBias,
          shadowNormalBias: s.shadowNormalBias, shadowSaturation: s.shadowSaturation, shadowFixedArea: s.shadowFixedArea,
          shadowNear: s.shadowNear, shadowFar: s.shadowFar, shadowOrthoSize: s.shadowOrthoSize,
          csmLevel: s.csmLevel, illuminance: s.illuminance, color: s.color.clone() };
        const g = scene.globals;
        this.sceneShadow = { enabled: g.shadows.enabled, type: g.shadows.type, size: g.shadows.shadowMapSize };
        this.ambientIllum = g.ambient.skyIllum;
        // Preserve raw float colors; the editor Color getter normalizes HDR > 1 and quantizes.
        const hdr = director.root!.pipeline.pipelineSceneData.isHDR;
        this.ambientSkyColor = (hdr ? g.ambient.skyColorHDR : g.ambient.skyColorLDR).clone();
        this.ambientGroundColor = (hdr ? g.ambient.groundAlbedoHDR : g.ambient.groundAlbedoLDR).clone();
      } else this.notices.push('Main Light missing; room sun/shadows unavailable');
      this.root = new Node('RoomAmbientRuntime'); model.addChild(this.root); this.root.active = false;
      this.configureRenderers(model, false);
      if (live(character)) this.configureRenderers(character, true);
      else this.notices.push('Character root missing; character shadow binding not applied');
      this.plant = remember(find(model, 'env_rear_window_plant'));
      this.sea = remember(find(model, 'env_sea_surface'));
      this.clouds = remember(find(model, 'env_cloud_layer'));
      this.bindSeaDetail();
      this.bindFoliageMaterials();
      this.bindLampEmission();
      this.createLamp();
      this.createSteam();
    } catch (error) { this.dispose(); throw error; }
  }

  private configureRenderers(root: Node, character: boolean): void {
    for (const r of root.getComponentsInChildren(MeshRenderer)) {
      // SkinnedMeshRenderer extends MeshRenderer, so the same flags reach body and clothes.
      const name = r.node.name;
      const transparent = /glass|sky|cloud|sea_|foam|beam|glow|moon|window_blind_cards/.test(name);
      const opaque = character || /^(env_interior_|env_int_anim_|env_lighthouse_door$|env_rear_window_)/.test(name);
      if (!transparent && !opaque) continue;
      this.states.push({ renderer: r, cast: r.shadowCastingMode, receive: r.receiveShadow });
      r.shadowCastingMode = transparent ? MeshRenderer.ShadowCastingMode.OFF : MeshRenderer.ShadowCastingMode.ON;
      r.receiveShadow = transparent ? MeshRenderer.ShadowReceivingMode.OFF : MeshRenderer.ShadowReceivingMode.ON;
    }
  }

  private bindFoliageMaterials(): void {
    // glTF doubleSided may import cull=NONE without USE_TWOSIDE. Standard 3.8.8
    // needs the latter to face back-side normals toward the viewer. Scope only
    // authored thin foliage meshes; never mutate the island's shared palette.
    const names = ['env_island_props_merged', 'env_prop_palm_lean_01',
      'env_prop_palm_tall_01', 'env_prop_palm_young_01', 'env_rear_window_palm'];
    for (const name of names) {
      const node = find(this.model, name); if (!node) continue;
      for (const r of node.getComponentsInChildren(MeshRenderer)) {
        for (let index = 0; index < r.sharedMaterials.length; index++) {
          const shared = r.getSharedMaterial(index), pass = shared?.passes[0];
          if (!shared || shared.effectName !== 'builtin-standard' || !pass ||
            pass.rasterizerState.cullMode !== 0 || r.getRenderMaterial(index) !== shared) {
            this.notices.push('Foliage material baseline changed; left untouched: ' + name); continue;
          }
          if (pass.defines.USE_TWOSIDE === true || pass.defines.USE_TWOSIDE === 1) continue;
          const instance = r.getMaterialInstance(index); if (!instance || instance === shared) continue;
          this.foliageMaterials.push({ renderer: r, index, shared, instance });
          instance.recompileShaders({ USE_TWOSIDE: true });
        }
      }
    }
  }

  private bindSeaDetail(): void {
    const r = this.sea?.node.getComponent(MeshRenderer), shared = r?.getSharedMaterial(0);
    if (!r || !shared || shared.effectName !== 'builtin-standard' || r.getRenderMaterial(0) !== shared) return;
    const pass = shared.passes[0], handle = pass?.getHandle('tilingOffset');
    // Older plain-color seas remain untouched. This optional binding requires the
    // imported wavelet texture and the existing standard albedo sampler; no tangent stream.
    if (!pass || !handle || !pass.defines.USE_ALBEDO_MAP || !shared.getProperty('mainTexture')) return;
    // One-time read-only import receipt. Sampling state must be observed on the
    // actual device before blaming absent mipmaps for distant high-frequency crests.
    const texture = shared.getProperty('mainTexture') as Texture2D;
    const sampler = typeof texture.getSamplerInfo === 'function' ? texture.getSamplerInfo() : null;
    const gpu = typeof texture.getGFXTexture === 'function' ? texture.getGFXTexture() : null;
    const receipt = JSON.stringify({ width: texture.width ?? null, height: texture.height ?? null,
      mipLevels: texture.mipmapLevel ?? null, gpuLevels: gpu?.levelCount ?? null,
      min: sampler?.minFilter ?? null, mag: sampler?.magFilter ?? null, mip: sampler?.mipFilter ?? null,
      anisotropy: sampler?.maxAnisotropy ?? null });
    this.notices.push('SeaSampler ' + receipt); console.info('[SeaSampler]', receipt);
    const base = new Vec4(); pass.getUniform(handle, base);
    if (![base.x, base.y, base.z, base.w].every(Number.isFinite)) return;
    const instance = r.getMaterialInstance(0);
    if (!instance || instance === shared) return;
    this.seaDetail = { renderer: r, shared, instance, base, offset: base.clone() };
    instance.setProperty('tilingOffset', this.seaDetail.offset);
  }

  private bindLampEmission(): void {
    // Frozen V3g: one palette primitive holds lamp_sway + clock_pendulum; only lamp UVs
    // hit nonblack emissive texels. Never edit M_env_palette, which the whole island shares.
    const node = find(this.model, 'env_int_anim_small_props');
    if (!node) { this.notices.push('Lamp mesh missing; emissive binding unavailable'); return; }
    for (const r of node.getComponentsInChildren(MeshRenderer)) {
      for (let index = 0; index < r.sharedMaterials.length; index++) {
        const shared = r.getSharedMaterial(index);
        if (!shared || shared.effectName !== 'builtin-standard' || r.getRenderMaterial(index) !== shared) {
          this.notices.push('Lamp material baseline changed; existing material left untouched'); continue;
        }
        const pass = shared.passes[0], handle = pass?.getHandle('emissiveScale');
        if (!pass || !handle) { this.notices.push('Lamp emissiveScale uniform missing'); continue; }
        // getProperty omits effect defaults. Read the actual uniform to preserve exact night values.
        const nightScale = new Vec3(); pass.getUniform(handle, nightScale);
        if (![nightScale.x, nightScale.y, nightScale.z].every(Number.isFinite)) {
          this.notices.push('Lamp emissiveScale is invalid'); continue;
        }
        const instance = r.getMaterialInstance(index);
        if (!instance || instance === shared) { this.notices.push('Lamp material instance unavailable'); continue; }
        this.lampEmissions.push({ renderer: r, index, shared, instance, nightScale });
        // With USE_EMISSIVE_MAP the shader replaces emissive.rgb with the texture sample;
        // zeroing emissive alone does not turn it off. Scale multiplies either path.
        instance.setProperty('emissiveScale', this.lampOffScale);
      }
    }
  }

  private applyLampState(night: boolean): void {
    if (live(this.lampNode)) this.lampNode.active = this.interior && night;
    if (this.lamp && isValid(this.lamp, true)) this.lamp.luminance = this.lampBase *
      (this.interior && night ? ROOM_LIGHTING.lampNightScale : ROOM_LIGHTING.lampDayScale);
    if (night === this.lampEmissionNight) return;
    this.lampEmissionNight = night;
    for (const s of this.lampEmissions) if (isValid(s.instance, true) &&
      isValid(s.renderer, true) && live(s.renderer.node) && s.renderer.getRenderMaterial(s.index) === s.instance) {
      s.instance.setProperty('emissiveScale', night ? s.nightScale : this.lampOffScale);
    }
  }

  private createLamp(): void {
    const anchor = find(this.model, 'fx_flame_hanging_lamp');
    if (!anchor) { this.notices.push('Lamp FX anchor missing; no invented fallback position'); return; }
    const lampNode = new Node('RoomWarmLamp'); this.lampNode = lampNode;
    this.root!.addChild(lampNode); lampNode.setWorldPosition(anchor.worldPosition);
    lampNode.setRotationFromEuler(-90, 0, 0); // Cocos light emits along local -Z.
    const lamp = lampNode.addComponent(SpotLight); this.lamp = lamp;
    lamp.color = new Color('#ffd39b'); lamp.range = ROOM_LIGHTING.lampRange;
    lamp.spotAngle = ROOM_LIGHTING.lampAngle; lamp.angleAttenuationStrength = ROOM_LIGHTING.lampEdgeSoftness; lamp.shadowEnabled = false;
    // The engine's default luminance already accounts for HDR/LDR. Never feed HDR lumens into LDR.
    this.lampBase = lamp.luminance; lamp.luminance = this.lampBase * ROOM_LIGHTING.lampDayScale;
    this.lampBinding = 'fixed-fx-anchor';
    const bone = find(this.model, 'lamp_sway');
    const anim = this.model.getComponent(SkeletalAnimation);
    const path = bone && anim ? pathFrom(anim.node, bone) : null;
    if (bone && anim && path) {
      const offset = new Vec3(); bone.inverseTransformPoint(offset, anchor.worldPosition);
      const existing = anim.sockets.find(s => s.path === path && live(s.target));
      let target = existing?.target || null;
      if (!target) {
        target = new Node('RoomLampSocket'); anim.node.addChild(target);
        const socket = new SkeletalAnimation.Socket(path, target);
        this.socketOwner = anim; this.socket = socket; this.ownedSocketTarget = target;
        // Setter registers both baked and real-time sockets. Do not animate the bone ourselves.
        anim.sockets = anim.sockets.concat(socket);
      }
      const worldRotation = lampNode.worldRotation.clone();
      target.addChild(lampNode); lampNode.setPosition(offset); lampNode.setWorldRotation(worldRotation);
      this.lampBinding = 'skeletal-socket';
    } else this.notices.push('lamp_sway path unavailable; lamp uses fixed FX anchor');
    lampNode.active = false;
  }

  private createSteam(): void {
    if (!EffectAsset.get('builtin-unlit')) { this.notices.push('builtin-unlit unavailable; steam skipped'); return; }
    const anchors = [find(this.model, 'fx_steam_teacup'), find(this.model, 'fx_steam_teapot')];
    if (!anchors.some(Boolean)) { this.notices.push('Tea FX anchors missing; steam skipped'); return; }
    const texture = new Texture2D(); this.texture = texture;
    texture.reset({ width: ROOM_LIGHTING.steamTextureWidth, height: ROOM_LIGHTING.steamTextureHeight,
      format: Texture2D.PixelFormat.RGBA8888, mipmapLevel: 1 });
    texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
    texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
    texture.uploadData(makeSteamPixels(ROOM_LIGHTING.steamTextureWidth, ROOM_LIGHTING.steamTextureHeight));
    // Two crossed ribbons, four triangles, .14m wide x .24m high; one mesh shared by both emitters.
    this.mesh = utils.createMesh({
      positions: [-.07, 0, 0, .07, 0, 0, -.07, .24, 0, .07, .24, 0,
        0, 0, -.07, 0, 0, .07, 0, .24, -.07, 0, .24, .07],
      uvs: [0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1],
      indices: [0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7],
      minPos: new Vec3(-.07, 0, -.07), maxPos: new Vec3(.07, .24, .07),
    });
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i]; if (!anchor) continue;
      const material = new Material(); this.materials.push(material);
      // Official builtin-unlit technique 3 is two-sided alpha blending with depthWrite=false.
      material.initialize({ effectName: 'builtin-unlit', technique: 3, defines: { USE_TEXTURE: true } });
      const color = new Color(241, 246, 244, 112);
      material.setProperty('mainTexture', texture); material.setProperty('mainColor', color);
      const node = new Node(i === 0 ? 'RoomTeaCupSteam' : 'RoomTeaPotSteam'); anchor.addChild(node);
      node.setRotationFromEuler(0, 25 + i * 41, 0); node.active = false;
      const r = node.addComponent(MeshRenderer); r.mesh = this.mesh; r.setMaterial(material, 0);
      r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; r.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
      this.steam.push({ node, phase: i * 2.1, color, material });
    }
  }

  /** Called after the world's own layer/day-night writer, so exterior lighting remains authored. */
  setView(interior: boolean, backdrop: boolean, night: boolean): void {
    if (this.disposed) return;
    const changed = interior !== this.interior;
    this.interior = interior; this.backdrop = backdrop; this.night = night;
    if (changed) this.roomWeight = interior ? 1 : 0;
    if (live(this.root)) this.root.active = interior;
    this.applyLampState(night);
    for (let i = 0; i < this.steam.length; i++) if (live(this.steam[i].node)) this.steam[i].node.active = interior;
    const s = this.sun, saved = this.sunState;
    if (!s || !saved || !isValid(s, true) || !live(s.node) || !isValid(this.scene, true)) return;
    if (interior) {
      const g = this.scene.globals;
      // T5: the owner (applyDayNight) has just written the island photometry for the current
      // day/night mode; keep it as the weight-0 end of the blend.
      this.islandIllum = s.illuminance; this.islandColor.set(s.color);
      if (changed) {
        g.shadows.type = renderer.scene.ShadowType.ShadowMap;
        g.shadows.shadowMapSize = ROOM_LIGHTING.shadowMapSize; g.shadows.enabled = true;
        // Window-normal sunlight reaches the visible floor beyond the tea table.
        s.node.setWorldPosition(.8, 6.6, -7); s.node.lookAt(new Vec3(-.4, .6, -2));
        this.interiorRotation.set(s.node.rotation);
        s.shadowEnabled = true; s.enableCSM = false; s.shadowFixedArea = true;
        s.shadowNear = .1; s.shadowFar = ROOM_LIGHTING.shadowFar; s.shadowOrthoSize = ROOM_LIGHTING.shadowOrthoSize;
        s.shadowPcf = renderer.scene.PCFType.SOFT_2X; s.shadowBias = .0001; s.shadowNormalBias = .015;
      }
      this.applyRoomWeight();
    } else if (changed) this.restoreSun(false);
  }

  /** T5 API — see the contract at the top of this file. Returns true when w was applied. */
  setRoomLightWeight(weight: number): boolean {
    if (this.disposed || !this.interior || !Number.isFinite(weight)) return false;
    this.roomWeight = Math.min(1, Math.max(0, weight));
    return this.applyRoomWeight();
  }

  /** T5 API (read-only, poll per frame; no events): current w in [0,1]. 0 outside an interior view and after dispose. */
  getRoomLightWeight(): number { return this.disposed || !this.interior ? 0 : this.roomWeight; }

  /** T5 API (read-only): true while this rig is alive (not disposed), i.e. getRoomLightWeight() is meaningful. */
  hasRoomLight(): boolean { return !this.disposed; }

  private applyRoomWeight(): boolean {
    const s = this.sun, saved = this.sunState;
    if (!s || !saved || !isValid(s, true) || !live(s.node) || !isValid(this.scene, true)) return false;
    const g = this.scene.globals, night = this.night, w = this.roomWeight;
    const roomIllum = saved.illuminance * (night ? ROOM_LIGHTING.moonlightScale : ROOM_LIGHTING.daylightScale);
    const roomColor = night ? this.sunNightColor : this.sunDayColor;
    const roomAmbient = saved.illuminance * (night ? ROOM_LIGHTING.ambientToMainNight : ROOM_LIGHTING.ambientToMainDay);
    const roomSat = night ? ROOM_LIGHTING.shadowSaturationNight : ROOM_LIGHTING.shadowSaturationDay;
    const skyC = night ? this.skyNightColor : this.skyDayColor, groundC = night ? this.groundNightColor : this.groundDayColor;
    if (w >= 1) {
      // Exactly the pre-T5 room values (same setters), so home/indoor look is byte-for-byte unchanged.
      s.node.setRotation(this.interiorRotation);
      s.illuminance = roomIllum; s.color = roomColor;
      g.ambient.skyIllum = roomAmbient;
      g.ambient.skyLightingColor = skyC; g.ambient.groundLightingColor = groundC;
      s.shadowSaturation = roomSat;
      return true;
    }
    Quat.slerp(this.blendRotation, saved.rotation, this.interiorRotation, w); s.node.setRotation(this.blendRotation);
    s.illuminance = this.islandIllum + (roomIllum - this.islandIllum) * w;
    Color.lerp(this.blendColor, this.islandColor, roomColor, w); s.color = this.blendColor;
    g.ambient.skyIllum = this.ambientIllum + (roomAmbient - this.ambientIllum) * w;
    if (this.ambientSkyColor && this.ambientGroundColor) {
      // Color setters store r/255..a/255 as the raw Vec4; lerp in that same space.
      this.roomSky.set(skyC.r / 255, skyC.g / 255, skyC.b / 255, skyC.a / 255);
      this.roomGround.set(groundC.r / 255, groundC.g / 255, groundC.b / 255, groundC.a / 255);
      Vec4.lerp(this.blendSky, this.ambientSkyColor, this.roomSky, w); g.ambient.skyColor = this.blendSky;
      Vec4.lerp(this.blendGround, this.ambientGroundColor, this.roomGround, w); g.ambient.groundAlbedo = this.blendGround;
    }
    // Saturation 0 = occlusion mixed fully back to lit: room shadows fade out instead of popping.
    s.shadowSaturation = roomSat * w;
    return true;
  }

  setPaused(paused: boolean): void { if (!this.disposed) { this.paused = paused; if (paused) this.accumulator = 0; } }

  /** Steady-state: no searches, arrays, vectors, materials, textures, meshes, or timers allocated. */
  advance(dt: number): void {
    if (this.disposed || this.paused || (!this.interior && !this.backdrop) || !Number.isFinite(dt) || dt <= 0) return;
    const step = Math.min(dt, .1); this.time = (this.time + step) % (Math.PI * 2 * 600);
    if (this.backdrop) this.seaDetailTime = (this.seaDetailTime + step) % 200;
    this.accumulator += step;
    if (this.accumulator < 1 / ROOM_LIGHTING.updateHz) return;
    this.accumulator %= 1 / ROOM_LIGHTING.updateHz; this.updates++;
    const t = this.time;
    if (this.interior) {
      const p = this.plant;
      if (p && live(p.node)) {
        Quat.fromEuler(this.delta, Math.sin(t * .73) * .6, 0, Math.sin(t * .57 + .4) * 1.1);
        Quat.multiply(this.rotation, p.rotation, this.delta); p.node.setRotation(this.rotation);
      }
      for (let i = 0; i < this.steam.length; i++) {
        const s = this.steam[i]; if (!live(s.node)) continue;
        const q = t * .8 + s.phase;
        s.node.setPosition(Math.sin(q) * .012, .014 + Math.sin(q * .71) * .012, Math.cos(q * .63) * .006);
        s.node.setScale(1 + Math.sin(q * .69) * .08, .91 + Math.sin(q * .57) * .09, 1);
        s.color.a = 105 + Math.sin(q * .83) * 17; s.material.setProperty('mainColor', s.color);
      }
      if (this.night && this.lamp && isValid(this.lamp, true)) this.lamp.luminance = this.lampBase *
        ROOM_LIGHTING.lampNightScale * (1 + Math.sin(t * .79) * .012);
    }
    if (this.backdrop) {
      const detail = this.seaDetail;
      if (detail && isValid(detail.instance, true) && isValid(detail.renderer, true) &&
        live(detail.renderer.node) && detail.renderer.getRenderMaterial(0) === detail.instance) {
        // One/two repeat cycles per200s. The repeat-sampler seam is continuous;
        // a dedicated bounded clock avoids the unrelated room-breathing clock wrap.
        detail.offset.z = detail.base.z + this.seaDetailTime * .005;
        detail.offset.w = detail.base.w + this.seaDetailTime * .01;
        detail.instance.setProperty('tilingOffset', detail.offset);
      }
      const sea = this.sea;
      if (sea && live(sea.node)) sea.node.setPosition(sea.position.x, sea.position.y + Math.sin(t * .41) * .003, sea.position.z);
      const c = this.clouds;
      if (c && live(c.node)) c.node.setPosition(c.position.x + Math.sin(t * .05) * .22, c.position.y, c.position.z);
    }
  }

  private restoreSun(includePhotometry: boolean): void {
    const s = this.sun, p = this.sunState;
    if (s && p && isValid(s, true) && live(s.node)) {
      s.node.setPosition(p.position); s.node.setRotation(p.rotation);
      s.shadowEnabled = p.shadowEnabled; s.shadowPcf = p.shadowPcf;
      s.shadowBias = p.shadowBias; s.shadowNormalBias = p.shadowNormalBias; s.shadowSaturation = p.shadowSaturation;
      s.shadowFixedArea = p.shadowFixedArea; s.shadowNear = p.shadowNear; s.shadowFar = p.shadowFar;
      s.shadowOrthoSize = p.shadowOrthoSize; s.csmLevel = p.csmLevel;
      if (includePhotometry) { s.illuminance = p.illuminance; s.color = p.color; }
    }
    if (isValid(this.scene, true) && this.sceneShadow) {
      const g = this.scene.globals, p = this.sceneShadow;
      g.shadows.enabled = p.enabled; g.shadows.type = p.type; g.shadows.shadowMapSize = p.size;
      g.ambient.skyIllum = this.ambientIllum;
      if (this.ambientSkyColor) g.ambient.skyColor = this.ambientSkyColor;
      if (this.ambientGroundColor) g.ambient.groundAlbedo = this.ambientGroundColor;
    }
  }

  diagnostics() {
    return { disposed: this.disposed, interior: this.interior, backdrop: this.backdrop, paused: this.paused,
      night: this.night, time: this.time, updates: this.updates, shadowSize: this.interior ? ROOM_LIGHTING.shadowMapSize : this.sceneShadow?.size,
      roomSunShadow: !!(this.interior && this.sun?.shadowEnabled), lampBinding: this.lampBinding,
      photometry: { sunIlluminance: this.sun?.illuminance ?? null, shadowSaturation: this.sun?.shadowSaturation ?? null,
        ambientSkyIllum: isValid(this.scene, true) ? this.scene.globals.ambient.skyIllum : null,
        lampLuminance: this.lamp?.luminance ?? null, exposureChanged: false },
      lampActive: !!(live(this.lampNode) && this.lampNode.active),
      lampEmissionBindings: this.lampEmissions.length, lampEmissionOn: this.lampEmissionNight,
      foliageTwoSidedBindings: this.foliageMaterials.length,
      seaDetailBound: !!this.seaDetail, seaDetailTime: this.seaDetailTime,
      lampShadow: false, steamEmitters: this.steam.length, shadowRenderers: this.states.length,
      plantBound: !!this.plant, seaBound: !!this.sea, cloudsBound: !!this.clouds, notices: this.notices.slice(),
      verification: 'Runtime configuration and lifecycle only; native Creator/WeChat visual/performance acceptance required.' };
  }

  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    const detail = this.seaDetail; this.seaDetail = null;
    if (detail) {
      if (isValid(detail.renderer, true) && live(detail.renderer.node) && isValid(detail.shared, true) &&
        detail.renderer.getRenderMaterial(0) === detail.instance) detail.renderer.setSharedMaterial(detail.shared, 0, true);
      else if (isValid(detail.instance, true)) detail.instance.destroy();
    }
    this.restoreSun(true);
    restore(this.plant); restore(this.sea); restore(this.clouds);
    for (const saved of this.states) if (isValid(saved.renderer, true) && live(saved.renderer.node)) {
      saved.renderer.shadowCastingMode = saved.cast; saved.renderer.receiveShadow = saved.receive;
    }
    for (const s of this.foliageMaterials) {
      if (isValid(s.renderer, true) && live(s.renderer.node) && isValid(s.shared, true) &&
        s.renderer.getRenderMaterial(s.index) === s.instance && s.renderer.getSharedMaterial(s.index) === s.shared) {
        s.renderer.setSharedMaterial(s.shared, s.index, true);
      } else if (isValid(s.instance, true)) s.instance.destroy();
    }
    this.foliageMaterials.length = 0;
    for (const s of this.lampEmissions) {
      if (isValid(s.renderer, true) && live(s.renderer.node) && isValid(s.shared, true) &&
        s.renderer.getRenderMaterial(s.index) === s.instance && s.renderer.getSharedMaterial(s.index) === s.shared) {
        // Official renderer setter destroys the owned instance. forceUpdate bypasses its
        // same-shared-material early return. Do not overwrite a later owner's replacement.
        s.renderer.setSharedMaterial(s.shared, s.index, true);
      } else if (isValid(s.instance, true)) s.instance.destroy();
    }
    this.lampEmissions.length = 0;
    // Child-first engine destruction can leave these nodes/components already destructed; never touch them.
    for (const s of this.steam) if (live(s.node)) s.node.destroy();
    if (live(this.lampNode)) this.lampNode.destroy();
    if (this.socketOwner && isValid(this.socketOwner, true) && live(this.socketOwner.node) && this.socket) {
      this.socketOwner.sockets = this.socketOwner.sockets.filter(s => s !== this.socket);
    }
    if (live(this.ownedSocketTarget)) this.ownedSocketTarget.destroy();
    if (live(this.root)) this.root.destroy();
    for (const material of this.materials) if (isValid(material, true)) material.destroy();
    if (this.mesh && isValid(this.mesh, true)) this.mesh.destroy();
    if (this.texture && isValid(this.texture, true)) this.texture.destroy();
    this.materials.length = 0; this.steam.length = 0; this.states.length = 0;
    this.lamp = null; this.lampNode = null; this.root = null; this.socketOwner = null; this.socket = null;
    this.ownedSocketTarget = null; this.mesh = null; this.texture = null;
    this.plant = null; this.sea = null; this.clouds = null; this.sun = null;
  }
}
