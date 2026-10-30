'use strict';
/** fallback=0 tally (Grok Bot decision 8, 10/30): the 2D tray fallback is insurance only. Any test whose output carries the
 *  BoardKit marker FAILs in run-suite, and the suite report sums the triggers (report.boardKitFallback). */
const MARKER='[QF_BOARD_KIT] fallback';
function count(text){if(!text)return 0;let n=0,i=-1;while((i=text.indexOf(MARKER,i+1))>=0)n++;return n;}
module.exports={MARKER,count};
