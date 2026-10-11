import { MeshRenderer, Node } from 'cc';
/** Disables renderers only. Never switches off chair/hand/skirt collision or rescales a character. */
export function hideNonShippingMeshes(root: Node, excludedNames: ReadonlySet<string>): number {
  let count = 0;
  function visit(node: Node, inherited: boolean) {
    const hidden = inherited || node.name.startsWith('col_') || excludedNames.has(node.name);
    if (hidden) for (const renderer of node.getComponents(MeshRenderer)) { renderer.enabled = false; count++; }
    for (const child of node.children) visit(child, hidden);
  }
  visit(root, false);
  return count;
}
