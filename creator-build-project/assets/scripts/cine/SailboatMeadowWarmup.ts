/**
 * Makes a freshly mounted meadow drawable before the cloud bank opens.
 * Houses, the path, and the windmill share a vertex-colour palette; meshes without
 * a_color compile to black on the GPU. The key light matches the meadow board rig,
 * on the world camera's visibility mask. No @ccclass: one Component per file.
 */
import { Animation, Camera, Color, Node, SphereLight, isValid } from 'cc';
import { applyMeadowNightSky, configureMeadowVertexColors } from '../region/MeadowBoardBackground';

const KEY_LIGHT = 'SailboatMeadowKeyLight';
let savedClear: { camera: Camera; r: number; g: number; b: number; a: number } | null = null;

export function prepareMeadowReveal(model: Node, cameraNode: Node): string[] {
  const changed = configureMeadowVertexColors(model);
  const cameras = model.getComponentsInChildren(Camera);
  for (let i = 0; i < cameras.length; i++) cameras[i].enabled = false;
  const clips = model.getComponentsInChildren(Animation);
  for (let i = 0; i < clips.length; i++) { clips[i].playOnLoad = false; clips[i].enabled = false; }
  const visibility = cameraNode.getComponent(Camera)?.visibility || (1 << 30);
  const lightNode = new Node(KEY_LIGHT);
  model.addChild(lightNode);
  lightNode.setPosition(-25, 80, 25);
  const light = lightNode.addComponent(SphereLight);
  light.color = new Color('#fff3da');
  light.range = 260;
  light.size = 30;
  light.luminance = light.luminance * 12;
  light.visibility = visibility;
  // Night sky and the key light are set before the hidden warm frames, and before the cover opens.
  syncSailboatMeadowNight(model, cameraNode);
  return changed;
}

/** Re-apply while the meadow is up so a night weight change does not wait for the level load. */
export function syncSailboatMeadowNight(model: Node, cameraNode: Node): void {
  const camera = cameraNode.getComponent(Camera);
  if (camera && camera.clearColor && !savedClear) {
    const c = camera.clearColor;
    savedClear = { camera, r: c.r, g: c.g, b: c.b, a: c.a };
  }
  let light: SphereLight | null = null;
  const lights = model.getComponentsInChildren(SphereLight);
  for (let i = 0; i < lights.length; i++) if (lights[i].node.name === KEY_LIGHT) light = lights[i];
  applyMeadowNightSky(model, camera, light);
}

export function restoreSailboatMeadowNight(): void {
  const saved = savedClear;
  savedClear = null;
  if (!saved || !isValid(saved.camera, true)) return;
  saved.camera.clearColor = new Color(saved.r, saved.g, saved.b, saved.a);
}
