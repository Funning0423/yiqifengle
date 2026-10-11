'use strict';
// Authored seed bank: all 36 openings have legal zero-tool winning witnesses.
// See tools/level-progression-fixtures/verified-mainline.json. This is guidance
// calibration, not a claim of measured human difficulty or of every play winning.
var banks = [[1,4,5],[1,3,13],[1,4,7],[1,3,6],[1,2,9],[1,2,8],[1,3,7],[1,7,13],[1,3,11],[1,6,9],[1,3,5],[1,3,6]];
banks.forEach(Object.freeze);
module.exports = Object.freeze(banks);
