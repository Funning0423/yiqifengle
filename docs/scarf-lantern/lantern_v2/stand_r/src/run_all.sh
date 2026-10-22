# TAG：烘布料 → 压缩 → 打包 → 重采样 → 肩部测量 → 全帧 QA（倒角 1 cm）+ 渲染
set -e;T=$1;cd /workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/stand_r
python3 ../stand_drape/src/bake_drape.py work/$T.glb work/${T}_dense.glb work/${T}_delta_raw.glb params.json
C=/workspace/yiqifengle/previews/角色动画bot/compress;(cd $C && LEGTOL=0.04 python3 compress_keeptr.py /workspace/yiqifengle/previews/角色动画bot/scarf-lantern/split/planB_cand3b_ribbonwind4b_stepdown_scarfbones.glb $OLDPWD/work/${T}_dense.glb $OLDPWD/work/${T}_comp.glb 0.2 0.2 lantern_pick_up_stand lantern_put_down_stand | tail -1 > $OLDPWD/work/${T}_compress.json)
python3 ../stand/src/make_pack_stand.py work/${T}_comp.glb work/${T}_pack.glb
python3 ../stand/src/resample_comp.py work/${T}_dense.glb work/${T}_comp.glb work/${T}_compqa.glb lantern_pick_up_stand lantern_put_down_stand
sed -i "s#INFO=../stand_r/work/[a-z0-9_]*info.json#INFO=../stand_r/work/${T}_info.json#" src/env2.sh
cd ../stand;. ../stand_r/src/env2.sh
SEARCH=1 SEARCH_PY=shoulder.py SH_OUT=../stand_r/work/${T}_shoulder.json CHAMFER=0.01 $B -b --python ../stand_r/src/qa_stand_r.py -- ../stand_r/work/${T}_compqa.glb $MT /tmp/s.json 2>&1 | grep "^lantern_" | cut -c1-400
[ -n "$NOQA" ] || CHAMFER=0.01 RENDER=${RENDER:-} bash ../stand_r/src/run_qa2.sh ../stand_r/work/${T}_compqa.glb ../stand_r/work/${T}_qa
