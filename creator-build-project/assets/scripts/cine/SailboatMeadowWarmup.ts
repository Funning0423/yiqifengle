/**
 * Makes a freshly mounted meadow drawable before the cloud bank opens.
 * Houses, the path, and the windmill share a vertex-colour palette; meshes without
 * a_color compile to black on the GPU. The key light matches the meadow board rig,
 * on the world camera's visibility mask. No @ccclass: one Component per file.
 */
import { Animation, Camera, Color, Node, SphereLight } from 'cc';
import { configureMeadowVertexColors } from '../region/MeadowBoardBackground';

export function prepareMeadowReveal(model: Node, cameraNode: Node): string[] {
  const changed = configureMeadowVertexColors(model);
  const cameras = model.getComponentsInChildren(Camera);
  for (let i = 0; i < cameras.length; i++) cameras[i].enabled = false;
  const clips = model.getComponentsInChildren(Animation);
  for (let i = 0; i < clips.length; i++) { clips[i].playOnLoad = false; clips[i].enabled = false; }
  const visibility = cameraNode.getComponent(Camera)?.visibility || (1 << 30);
  const lightNode = new Node('SailboatMeadowKeyLight');
  model.addChild(lightNode);
  lightNode.setPosition(-25, 80, 25);
  const light = lightNode.addComponent(SphereLight);
  light.color = new Color('#fff3da');
  light.range = 260;
  light.size = 30;
  light.luminance = light.luminance * 12;
  light.visibility = visibility;
  return changed;
}
