'use strict';
/** r4 new-regions: the 9 .meta files Creator must generate (paths relative to creator-build-project/). Importers match the
 *  exact allowAdd entries in tools/build-guard/meta-allowlist.json (test_meta_import_ext.cjs checks both stay in sync). */
const R4_METAS = Object.freeze([
  ['assets/scripts/ui/JourneyCore.ts.meta', 'typescript'],
  ['assets/scripts/ui/JourneyUi.ts.meta', 'typescript'],
  ['assets/scripts/ui/PopupMotion.ts.meta', 'typescript'],
  ['assets/scripts/ui/PublicationInfo.ts.meta', 'typescript'],
  ['assets/scripts/ui/UpdatePromptCore.ts.meta', 'typescript'],
  ['assets/bundles/board_art/journey_ui.meta', 'directory'],
  ['assets/bundles/board_art/journey_ui/JourneyPanels.ts.meta', 'typescript'],
  ['assets/bundles/board_art/popup/reward_seal_coast.png.meta', 'image'],
  ['assets/bundles/board_art/r2/region_coast.png.meta', 'image'],
]);
const dbUrl = meta => 'db://' + meta.replace(/\.meta$/, '');
/** Pure check of what Creator produced: {path -> parsed meta | null}. Returns problems (empty = ok). */
function verify(found) {
  const bad = [];
  for (const [p, imp] of R4_METAS) {
    const m = found[p];
    if (!m) { bad.push('MISSING ' + p); continue; }
    if (m.importer !== imp) bad.push(`IMPORTER ${p} ${m.importer} != ${imp}`);
    if (!m.uuid) bad.push('NO_UUID ' + p);
  }
  return bad;
}
module.exports = { R4_METAS, dbUrl, verify };
