'use strict';
/**
 * 0008 v5 — exact console rules for the first open of the Creator 3.8.8 wechatgame output in DevTools 2.02.2608080 / lib 3.17.3.
 * Shared by wechat_first_open_audit.cjs (structured channels) and usable alone on a console text copy:
 *   node tools/first_open_console_rules.cjs <console-copy.txt>   → JSON verdict, exit 0 ZERO_RED / 3 KNOWN_NOTICE_ONLY / 1 FAIL / 2 INCOMPLETE|REVIEW
 */
const fs = require('fs');

/** The one IDE diagnostic under investigation. Exact text; optional "(env: …)" suffix, no source location. */
const KNOWN_IDE_NOTICE = /^\[app\.json 或自定义编译条件错误\] app\.json 中未定义自定义编译中指定的启动页面(?: \(env: (?:macOS|Windows),mg,\d+\.\d+\.\d+; lib: \d+\.\d+\.\d+\))?$/; // v4: env/lib tail must have the exact DevTools shape (no free text)

/** v4: the notice is recognised ONLY as a whole normalised payload (no end-of-line / suffix extraction). */
const normalize = (text) => String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim();
const isKnownNotice = (payload) => KNOWN_IDE_NOTICE.test(normalize(payload));

/** Lines expected on a healthy first open (informational; LoadScene is REQUIRED as proof the game started). */
const EXPECTED = [
  {id: 'lib-banner', re: /^Wechat Lib:\d+\.\d+\.\d+, /},
  {id: 'api-notice-header', re: /^.*GMT[+-]\d{4} \(.*\) 接口提示$/},
  {id: 'harmonyos-notice', re: /^小程序基础库从 3\.7\.0 起正式支持 HarmonyOS 平台/},
  {id: 'device-info-log', re: /^(WAGame\.js:1 )?\{batteryLevel: \d+, benchmarkLevel: -?\d+, brand: "devtools"/},
  {id: 'device-info-collapsed', re: /^Object$/},
  {id: 'loadscene', re: /^(cc\.js\? \[sm\]:1 )?LoadScene db:\/\/assets\/scenes\/WorldR5Integration\.scene: [\d.]+ ms$/, required: true},
  {id: 'qf-audit-heartbeat', re: /^\[QF-AUDIT-HEARTBEAT(-LATE)?\] [0-9a-f]+$/},
  {id: 'qf-audit-canary', re: /^\[QF-AUDIT-CANARY(-LATE)?\] [0-9a-f]+$/}, // test-copy-only positive control (console.error with the run token)
];

/** Anything matching these is a real failure. */
const FORBIDDEN = [
  {id: 'babel-helper-missing', re: /@babel\/runtime\/helpers\/\w+(\.js)?' is not defined/},
  {id: 'prerequisite-imports', re: /Unable to instantiate virtual:\/\/\/prerequisite-imports\/main/},
  {id: 'miniprogram-error', re: /\bMiniProgramError\b/},
  {id: 'js-error', re: /\b(TypeError|ReferenceError|SyntaxError|RangeError|EvalError|URIError|AggregateError|InternalError|DOMException|Uncaught)\b/},
  {id: 'plain-error', re: /(^|[\s:;,(\[])Error:/},
  {id: 'simulator-launch-failed', re: /simulator launch failed|模拟器启动失败/i},
  {id: 'bracket-error-category', re: /\[[^\]]*错误[^\]]*\]/}, // ANY "[…错误…]" category anywhere in the payload (the exact known notice is matched first, as a whole)
  {id: 'game-json-error', re: /game\.json\s*(文件内容错误|解析失败|error)/i},
  {id: 'compile-failed', re: /编译(失败|错误)/},
];

/** Stack-trace / DevTools grouping noise that belongs to the preceding message. */
const CONTINUATION = /^\s+at |\s@\s|^\(anonymous\) @|^(setTimeout|script|Promise\.then) \(async\)$|^Show \d+ more frames$|^module '|^\S+ @ \S+/;

/** Error text recognition shared by transcripts, automator, shim, WeappLog and CLI (v4: one rule set). */
function errorId(payload) { const t = normalize(payload); for (const f of FORBIDDEN) if (f.re.test(t)) return f.id; return null; }

/**
 * WeappLog line protocol supported by v4 (documented in README §4; anything else is still scanned, fail-closed):
 *   [<ISO-8601 timestamp>]* [<own marker: copy path | unique projectname>]? [<level tag>]? <payload>
 *   level tag = [error] [warn] [warning] [log] [info] [debug] or the same with "console." prefix, e.g. [console.error].
 * The first level tag anywhere on the line sets the level. The payload is the text after it only when nothing but
 * timestamps/own marker precede the tag; otherwise (v5) the payload is the whole remainder including the unknown prefix.
 * With no tag the level is "unknown" and the payload is the line minus leading timestamps/own marker.
 */
const TS_PREFIX = /^\[?\d{4}-\d\d-\d\d[T ][\d:.]+(?:Z|[+-]\d\d:?\d\d)?\]?\s*/;
const LEVEL_TAG = /\[(?:console\.)?(error|warn|warning|log|info|debug)\]\s*/i;
function parseLogLine(line, ownMarkers = []) {
  let s = String(line);
  const own = ownMarkers.some((m) => m && s.includes(m));
  for (let k = 0; k < 8; k++) {
    const before = s;
    s = s.replace(TS_PREFIX, '');
    for (const m of ownMarkers) if (m && s.startsWith(m)) s = s.slice(m.length).replace(/^\s+/, '');
    if (s === before) break;
  }
  const lv = LEVEL_TAG.exec(s);
  if (!lv) return {own, level: 'unknown', payload: s, prefix: ''};
  const level = lv[1].toLowerCase() === 'warning' ? 'warn' : lv[1].toLowerCase();
  const prefix = s.slice(0, lv.index);
  // v5: text before the level tag is not a recognised protocol field. The whole remainder is judged, so an error in the
  // prefix is still seen and a canary/notice can never be exempt when anything precedes its tag.
  if (prefix.trim()) return {own, level, payload: s, prefix, prefixUnknown: true};
  return {own, level, payload: s.slice(lv.index + lv[0].length), prefix: ''};
}

/** v5: CLI stdout/stderr lines get the same level normalisation as WeappLog lines (no own-marker stripping). */
function parseCliLine(line) { const p = parseLogLine(line, []); return {level: p.level, payload: p.payload, prefixUnknown: !!p.prefixUnknown}; }

/**
 * One normalised event → exactly one kind. Order matters and is the whole policy:
 *  1. exact canary (whole payload == "[QF-AUDIT-CANARY] <token>" / "-LATE", level error|unknown) → canary-boot / canary-late
 *  2. canary-shaped payload with a different token, exactly → canary-foreign
 *  3. exact known notice (whole normalised payload) → known-notice
 *  4. level error → error (recognised id, or "unrecognised-error-level")
 *  5. recognised error text at any other level → error
 *  6. warn → warn, else info
 * A canary or notice with ANY extra text is not 1–3; the event is judged by 4/5 like any other.
 */
function classifyEvent({level = 'unknown', payload = '', token = null}) {
  const p = normalize(payload);
  const m = /^\[QF-AUDIT-CANARY(-LATE)?\] ([0-9a-f]{16})$/.exec(p);
  if (m && (level === 'error' || level === 'unknown')) {
    if (token && m[2] === token) return {kind: m[1] ? 'canary-late' : 'canary-boot'};
    return {kind: 'canary-foreign'};
  }
  if (isKnownNotice(p)) return {kind: 'known-notice', id: 'app-json-custom-condition'};
  const id = errorId(p);
  if (level === 'error') return {kind: 'error', id: id || 'unrecognised-error-level'};
  if (id) return {kind: 'error', id};
  return {kind: level === 'warn' ? 'warn' : 'info'};
}

function classifyText(text) {
  const t = normalize(text);
  if (KNOWN_IDE_NOTICE.test(t)) return {kind: 'known-ide-notice', id: 'app-json-custom-condition'};
  for (const f of FORBIDDEN) if (f.re.test(t)) return {kind: 'forbidden', id: f.id};
  for (const e of EXPECTED) if (e.re.test(t)) return {kind: 'expected', id: e.id, required: !!e.required};
  return {kind: 'unclassified', id: null};
}

/** Classify a DevTools console text copy (as Oi saves them). */
function classifyTranscript(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  const out = {expected: [], knownNotice: [], forbidden: [], unclassified: [], continuation: 0};
  for (const l of lines) {
    const c = classifyText(l);
    if (c.kind === 'unclassified' && CONTINUATION.test(l)) { out.continuation++; continue; }
    const rec = {id: c.id, line: l};
    if (c.kind === 'expected') out.expected.push(rec); else if (c.kind === 'known-ide-notice') out.knownNotice.push(rec); else if (c.kind === 'forbidden') out.forbidden.push(rec); else out.unclassified.push(rec);
  }
  out.loadSceneSeen = out.expected.some((e) => e.id === 'loadscene');
  out.verdict = out.forbidden.length ? 'FAIL' : !out.loadSceneSeen ? 'INCOMPLETE' : out.unclassified.length ? 'REVIEW' : out.knownNotice.length ? 'KNOWN_NOTICE_ONLY' : 'ZERO_RED';
  return out;
}

const VERSION = '0008-v5';
module.exports = {VERSION, KNOWN_IDE_NOTICE, normalize, isKnownNotice, errorId, parseLogLine, parseCliLine, classifyEvent, EXPECTED, FORBIDDEN, classifyText, classifyTranscript};

if (require.main === module) {
  const f = process.argv[2];
  if (!f) { console.error('usage: node first_open_console_rules.cjs <console-copy.txt>'); process.exit(2); }
  const r = classifyTranscript(fs.readFileSync(f, 'utf8'));
  console.log(JSON.stringify(r, null, 2));
  process.exit({ZERO_RED: 0, KNOWN_NOTICE_ONLY: 3, FAIL: 1}[r.verdict] ?? 2);
}
