const {SCR,RBL,BLy,MS,J}=require('./feas.cjs');const g=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/girl-frame.cjs');
const out=SCR.slice(0,7).map(([w,h])=>{const s=BLy.boardSafeInsets(w,h);const st=J.standFor(w,h);return {scr:w+'x'+h,cam:MS.meadowScenePose(w/h),ui:RBL.girlStandUi(w,h,s),box:st.boxPt,old:RBL.girlBoxPt(MS.meadowScenePose(w/h),J.mp('walk_path_02'),w,h)};});
require('fs').writeFileSync('panel_m2.json',JSON.stringify(out));
