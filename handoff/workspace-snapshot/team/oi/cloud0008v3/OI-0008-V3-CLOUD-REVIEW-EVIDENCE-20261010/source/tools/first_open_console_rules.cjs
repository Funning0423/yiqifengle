'use strict';
/**
 * 0008 v3 — exact console rules for the first open of the Creator 3.8.8 wechatgame output in DevTools 2.02.2608080 / lib 3.17.3.
 * Shared by wechat_first_open_audit.cjs (structured channels) and usable alone on a console text copy:
 *   node tools/first_open_console_rules.cjs <console-copy.txt>   → JSON verdict, exit 0 ZERO_RED / 3 KNOWN_NOTICE_ONLY / 1 FAIL / 2 INCOMPLETE|REVIEW
 */
const fs = require('fs');

/** The one IDE diagnostic under investigation. Exact text; optional "(env: …)" suffix, no source location. */
const KNOWN_IDE_NOTICE = /^\[app\.json 或自定义编译条件错误\] app\.json 中未定义自定义编译中指定的启动页面(?:\s*\(env: [^)]*\))?$/;

/** Same notice embedded at the END of a log-file line (e.g. "<timestamp> [console.error] <notice>"); used only for WeappLog / CLI lines. */
const KNOWN_IDE_NOTICE_IN_LINE = /(\[app\.json 或自定义编译条件错误\] app\.json 中未定义自定义编译中指定的启动页面(?:\s*\(env: [^)]*\))?)\s*$/;
function extractKnownNotice(line) { const m = KNOWN_IDE_NOTICE_IN_LINE.exec(String(line)); return m && KNOWN_IDE_NOTICE.test(m[1]) ? m[1] : null; }

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
  {id: 'js-error', re: /\b(TypeError|ReferenceError|SyntaxError|RangeError|Uncaught)\b|(^|\s)Error: /},
  {id: 'simulator-launch-failed', re: /simulator launch failed|模拟器启动失败/i},
  {id: 'other-bracket-error', re: /^\[[^\]]*错误\]/}, // any other "[… 错误]" IDE diagnostic (the known notice is matched first)
  {id: 'compile-failed', re: /编译(失败|错误)/},
];

/** Stack-trace / DevTools grouping noise that belongs to the preceding message. */
const CONTINUATION = /^\s+at |\s@\s|^\(anonymous\) @|^(setTimeout|script|Promise\.then) \(async\)$|^Show \d+ more frames$|^module '|^\S+ @ \S+/;

function classifyText(text) {
  const t = String(text).trim();
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

module.exports = {KNOWN_IDE_NOTICE, extractKnownNotice, EXPECTED, FORBIDDEN, classifyText, classifyTranscript};

if (require.main === module) {
  const f = process.argv[2];
  if (!f) { console.error('usage: node first_open_console_rules.cjs <console-copy.txt>'); process.exit(2); }
  const r = classifyTranscript(fs.readFileSync(f, 'utf8'));
  console.log(JSON.stringify(r, null, 2));
  process.exit({ZERO_RED: 0, KNOWN_NOTICE_ONLY: 3, FAIL: 1}[r.verdict] ?? 2);
}
