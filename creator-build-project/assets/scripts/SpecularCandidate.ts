import { Material, MeshRenderer, Node } from 'cc';

// Separate runtime material instances: the delivered GLB and imported materials stay unchanged.
// Cocos standard uses dielectric F0 = 0.08 * specularIntensity; glTF default F0 is 0.04.
// This scalar F0 candidate does not implement the extension's entire Fresnel/grazing response.
export function applySpecularCandidate(root: Node) {
  const factors: Record<string, number> = { M_env_palette: 0.4000000059604645,
    M_env_palette_interior_1s: 0.4000000059604645, M_env_sea: 0.699999988079071 };
  const applied: any[] = [], unmatched = new Set<string>();
  for (const renderer of root.getComponentsInChildren(MeshRenderer)) {
    for (let i = 0; i < renderer.sharedMaterials.length; i++) {
      const original = renderer.getMaterial(i);
      if (!original) continue;
      const factor = factors[original.name];
      if (factor === undefined) { unmatched.add(original.name); continue; }
      const candidate = new Material(); candidate.copy(original);
      candidate.name = original.name + '-specular-candidate';
      candidate.setProperty('specularIntensity', 0.5 * factor);
      renderer.setMaterial(candidate, i);
      applied.push({ node: renderer.node.name, sourceMaterial: original.name, factor, specularIntensity: 0.5 * factor });
    }
  }
  return { scope: 'scalar dielectric F0 candidate; visual approval pending; not full KHR implementation', applied, unmatched: Array.from(unmatched) };
}
