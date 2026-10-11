# art-src/character/env.sh — 所有 .sh 脚本开头 source 这个文件；任何一项都可以先 export 覆盖。
CHAR_ROOT="${CHAR_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
REPO_ROOT="${REPO_ROOT:-$(cd "$CHAR_ROOT/../.." && pwd)}"
BLENDER="${BLENDER:-$(command -v blender 2>/dev/null || echo /usr/local/bin/blender)}"
# e60 = 运行时角色 GLB（只读输入，不要覆盖）
E60="${E60:-$REPO_ROOT/creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb}"
# 角色动画bot 的走路 v2 TEST GLB（副本；原件在箱子 /workspace/yiqifengle/previews/角色动画bot/walk-v2/）
W2="${W2:-$CHAR_ROOT/_deps/walk-v2/chr_b_r5g2_walk-v2_TEST.glb}"
V12_REF="${V12_REF:-$CHAR_ROOT/reference/character-ankle-balanced-v12.jpg}"
# 草坡电影截图不进仓库（见 handoff 文档“参考图”一节）；留空时对比图自动去掉“参考图”列
FILM_REF="${FILM_REF:-}"
HUNYUAN_GLB="${HUNYUAN_GLB:-/workspace/yiqifengle/previews/grokbot/hunyuan-head/hunyuan_head_v31.glb}"
export CHAR_ROOT REPO_ROOT BLENDER E60 W2 V12_REF FILM_REF HUNYUAN_GLB
