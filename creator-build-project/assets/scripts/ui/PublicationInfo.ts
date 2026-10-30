/** Publication info shown on the health advisory page (SPEC system-panels §1.4). Empty until Funning provides it.
 *  Fill all four fields here only; the block shows only when all four are non-empty strings, otherwise nothing is created.
 *  Mirrored in build-templates/wechatgame/first-screen.js (PUBLICATION_INFO), kept equal by tools/system-panels test. */
export const PUBLICATION_INFO: { copyright?: string; publisher?: string; approval?: string; isbn?: string } = {};
export const PUBLICATION_KEYS = ['copyright', 'publisher', 'approval', 'isbn'] as const;
/** All-or-nothing: four trimmed non-empty strings → lines, else null (block not created). */
export function publicationLines(info: Record<string, unknown> = PUBLICATION_INFO): string[] | null {
  const out: string[] = [];
  for (const k of PUBLICATION_KEYS) { const v = info[k]; if (typeof v !== 'string' || !v.trim()) return null; out.push(v.trim()); }
  return out;
}
