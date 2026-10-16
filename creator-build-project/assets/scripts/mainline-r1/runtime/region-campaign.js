'use strict';
// Presentation and read-only progression seam for the existing 12-stage campaign.
// No storage, scene loading, movement, completion, or reward mutations live here.
// Pass a validated JourneyBridge snapshot/view, never a UI counter or raw save.
var Engine = require('./vendor/engine'), seeds = require('./verified-seeds');
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.keys(value).forEach(function (key) { freeze(value[key]); });
    Object.freeze(value);
  }
  return value;
}
function id(level) { return 'mainline-' + String(level + 1).padStart(2, '0'); }
function levelOf(stageId) {
  var match = typeof stageId === 'string' && /^mainline-(0[1-9]|1[0-2])$/.exec(stageId);
  return match ? Number(match[1]) - 1 : -1;
}
var REGIONS = freeze([
  {id: 'island', legacyRegion: 'tide', index: 0, name: '潮汐小岛', entryAfter: 0, giftId: 'tideNet'},
  {id: 'meadow', legacyRegion: 'meadow', index: 1, name: '风车草原', entryAfter: 4, giftId: 'sunSeed'},
  {id: 'skycity', legacyRegion: 'sky', index: 2, name: '天空之城', entryAfter: 8, giftId: 'starShears'}
]);
var beats = [
  ['露珠问候', 'introduce', '先收集一种果实，熟悉相邻交换。'],
  ['苔径初开', 'combine', '在目标格消除，试着用竖向特殊果实清理苔藓。'],
  ['浆果野餐', 'practice', '兼顾两种收集目标，寻找能形成四连的位置。'],
  ['小径守卫', 'finale', '围绕根须安排消除，走完小岛的第一段旅程。'],
  ['风车下的花环', 'introduce', '沿环形目标开路；先处理边缘苔藓，再补齐蓝莓。'],
  ['草桥双结', 'combine', '双层根须需要分波命中，让特殊果实覆盖两侧。'],
  ['风铃合奏', 'practice', '暂别固定障碍，收集青叶与花朵，练习制造特殊果实。'],
  ['长风的约定', 'finale', '先解中心三层根结，再用连锁照顾周围苔藓。'],
  ['云阶初见', 'introduce', '沿阶梯清理苔藓，兼顾两侧双层根须。'],
  ['星门前的根结', 'combine', '集中处理三层根须，用范围特殊果实同时命中多处。'],
  ['云庭花园', 'practice', '四角苔藓与四类目标并列，优先照顾难触及的角落。'],
  ['天空之城的回声', 'finale', '把中心与边缘目标串起来，完成三地区旅程。']
];
// Exact move budgets/goal counts/obstacles remain owned by the frozen engine.
// Metadata is deliberately absent from checkpoint content signatures: old replays
// remain byte-identical, including interrupted pre-update attempts.
var STAGES = freeze(Engine.levels.map(function (config, level) {
  var region = REGIONS[Math.floor(level / 4)], beat = beats[level];
  return {
    id: id(level), level: level, ordinal: level + 1, regionOrdinal: level % 4 + 1,
    region: region.legacyRegion, regionId: region.id, chapter: region.index + 1,
    chapterName: region.name, name: beat[0], sourceName: config.name,
    description: level >= 4 ? beat[2] : config.description,
    learningBeat: beat[1], strategy: beat[2], moves: config.moves,
    goals: copy(config.goals), goalOrder: Object.keys(config.goals),
    moss: copy(config.moss || []), roots: copy(config.roots || []),
    starters: copy(config.starters || []), seedBank: seeds[level].slice(),
    contentRevision: 'mainline-regions-20261015',
    rulesRevision: 'frozen-mainline-v33',
    rewardPolicy: {chest: 'first-clear-then-explicit-claim', regionGift: 'first-stage-clear-then-explicit-claim'},
    difficultyEvidence: 'shipped-seed-winning-witnesses; human-difficulty-unmeasured'
  };
}));
function regionOf(value) {
  return REGIONS.find(function (region) { return region.id === value || region.legacyRegion === value; }) || null;
}
function stage(stageId) { var level = levelOf(stageId); return level < 0 ? null : STAGES[level]; }
function invalidJourney(journey) {
  if (!journey || typeof journey.readOnly !== 'boolean' || !Array.isArray(journey.records)) return 'journey-unavailable';
  if (journey.readOnly) return 'journey-readonly';
  if (journey.records.length !== 12) return 'journey-records-invalid';
  for (var i = 0; i < 12; i++) {
    var record = journey.records[i];
    if (!record || !Number.isInteger(record.bestStars) || record.bestStars < 0 || record.bestStars > 3 ||
        !Number.isSafeInteger(record.clears) || record.clears < 0 ||
        (record.bestStars > 0) !== (record.clears > 0)) return 'journey-records-invalid';
  }
  return null;
}
function prefixCleared(journey, count) {
  for (var i = 0; i < count; i++) if (!journey.records[i].bestStars) return false;
  return true;
}
function canEnterRegion(journey, regionId) {
  var region = regionOf(regionId);
  if (!region) return {ok: false, reason: 'unknown-region'};
  var reason = invalidJourney(journey);
  if (reason) return {ok: false, reason: reason};
  return prefixCleared(journey, region.entryAfter) ? {ok: true} : {ok: false, reason: 'region-locked'};
}
function transition(journey, fromStageId, toStageId) {
  var from = stage(fromStageId), to = stage(toStageId);
  if (!from || !to) return {ok: false, reason: 'unknown-stage'};
  var response = {ok: false, fromRegion: from.regionId, toRegion: to.regionId,
    requiresTravel: false, nextStageId: to.id};
  if (to.level !== from.level + 1) return Object.assign(response, {reason: 'nonsequential-stage-transition'});
  var reason = invalidJourney(journey);
  if (reason) return Object.assign(response, {reason: reason});
  if (!prefixCleared(journey, to.level)) return Object.assign(response, {reason: 'completion-not-recorded'});
  return Object.assign(response, {ok: true, requiresTravel: from.regionId !== to.regionId});
}
function inspect(journey) {
  var reason = invalidJourney(journey), valid = !reason;
  var regions = REGIONS.map(function (region) {
    var first = region.index * 4, cleared = 0, stars = 0;
    if (valid) for (var i = first; i < first + 4; i++) { stars += journey.records[i].bestStars; if (journey.records[i].bestStars) cleared++; }
    var unlocked = valid && prefixCleared(journey, first);
    var claimKnown = valid && Array.isArray(journey.regionClaims) && typeof journey.regionClaims[region.index] === 'boolean';
    var claimed = claimKnown ? journey.regionClaims[region.index] : null;
    return Object.assign({}, region, {unlocked: unlocked, completedCount: cleared, totalStages: 4,
      completed: valid && prefixCleared(journey, first + 4), stars: stars, maxStars: 12,
      firstStageId: id(first), lastStageId: id(first + 3),
      nextStageId: unlocked ? STAGES.slice(first, first + 4).filter(function (s) { return !journey.records[s.level].bestStars; }).map(function (s) { return s.id; })[0] || null : null,
      challengeUnlocked: valid && prefixCleared(journey, first + 4),
      gift: {id: region.giftId, unlocked: valid && prefixCleared(journey, first + 1), claimed: claimed,
        pending: claimKnown && prefixCleared(journey, first + 1) && !claimed},
      stages: STAGES.slice(first, first + 4)
    });
  });
  return freeze({revision: 'region-campaign-1', ok: valid, reason: reason, regions: regions,
    completed: valid && prefixCleared(journey, 12),
    nextStageId: valid ? STAGES.filter(function (s) { return !journey.records[s.level].bestStars; }).map(function (s) { return s.id; })[0] || null : null});
}
function rewardHandoff(journey, stageId, ready) {
  var current = stage(stageId), view = inspect(journey);
  if (!ready || !current || !view.ok || !prefixCleared(journey, current.level + 1)) return null;
  var chest = Array.isArray(journey.chests) ? journey.chests.find(function (x) { return x.level === current.level; }) : null;
  var region = view.regions[Math.floor(current.level / 4)];
  return freeze({stageId: stageId, regionId: region.id,
    chest: {level: current.level, earned: !!(chest && chest.earned), opened: !!(chest && chest.opened),
      pending: !!(chest && chest.earned && !chest.opened), rewards: chest && Array.isArray(chest.rewards) ? copy(chest.rewards) : []},
    regionGift: copy(region.gift),
    nextRegion: current.regionOrdinal === 4 && current.level < 11 ? REGIONS[region.index + 1].id : null,
    campaignComplete: view.completed});
}
module.exports = {regions: REGIONS, stages: STAGES, stage: stage, inspect: inspect,
  canEnterRegion: canEnterRegion, transition: transition, rewardHandoff: rewardHandoff};
