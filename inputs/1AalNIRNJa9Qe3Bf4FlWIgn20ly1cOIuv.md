# 咦起风了 A至F追加核验勘误

2026-10-08 23:31 UTC。此文件追加于 MIG-003-AF-20261008-2328，不覆盖原交接。以下静态核验细化原文中的未知项，不表示Cocos、Blender动作或真机验收。

## 已核验及原文需细化处

室内ZIP为19,506,119 bytes，SHA256 e48534a69128eeb5a66595a43bd511eb63a476c70d8c0ef978c3025063e76726。PACKAGE-MANIFEST所列198文件全部大小/hash一致；ZIP含manifest共199条目。

27对米制/GU GLB的binary payload相同；规范化glTF显式默认值后 meshes/skins/animations/accessors/bufferViews等价。GU_root_x1p415282实际一致root scale为1.415282392026578。故该数值作为包内“米制场景到旧GU场景转换”已静态验证；原交接称×1.415282未核验，应限定为“尚未核验能否用于B人物身高适配”，不能把已验证的环境换算混同人物量尺。1GU约0.7065727699530516m，仅为该源推导关系。B_reference_height_m仍为空，不能直接将环境倍数套到B源顶点。

make_game_unit_variants.py的docstring倒数表述有误，实际代码和27个root均使用乘数；请在下一候选版本修正说明，保留旧冻结包。

相机-4.95是包内米制场景坐标，camera-world t0亦待同空间比较；切勿把数值直接写入旧GU相机。env_interior_floor_skirt_preview确实是可渲染mesh，extras标为preview_only=true、ship=false；集成时必须显式排除/隐藏，不能只信元数据。col_*的render=false同样需导入器落实。

## P0必须补齐或澄清

- 缺少seat_back语义anchor；已有col_int_chair_back不能无声明替代。请补真实node_path或明确适配绑定。当前室内也没有scene_root，需明确根映射。
- 路径报告exit最小0.002m、stand最小0.008m只指采样点到椅几何距离，不是角色胶囊、手、裙的净空证明。按原交接只在必要受控坐起状态过滤locomotion capsule，保留独立手裙接触。
- return_path_00与exit_path_17实际相差约0.0030m，分别为(-2.1119,0,5.2839)和(-2.1135,0,5.2814)。不能声称完全相等；保留各自语义或声明容差。
- 门把anchor extras.ring_radius_m=0.016，与文档/测试所列中心线半径0.07m、管半径0.012m冲突。grip target对齐不等于半径语义正确；请量测权威几何并澄清字段后再作为手部接触依据。
- assembled metre scene有5 skins、1条idle_loop共75channels、14个col_*节点。idle_loop是环境/摆件动画，不是B角色坐起开门完整动作。双方receipt明确角色动作尚未交付。
- GU assembled scene的5个skinned mesh节点仍为scene roots而joints在GU root下。静态结构对应不证明Cocos skinned bounds、蒙皮缩放和动画运行正确，需导入回归。

## 仅receipt陈述或仍未验证

此次未独立下载外景ZIP与B源，故B的11,713顶点、20,373三角、22骨、0 Actions和围裙拓扑描述仍属receipt信息；独立候选拆分继续按源顶点/面映射、UV/rest/权重验收。reported两顶点有5 influences，≤4权重归一化需单独验证，不能无检查裁权重。

9m机器人为提案，所列11个交付文件中没有sky_city；没有机器人外观批准、天空交付或导入证据。外景围栏0.38–0.44m路径距离、shell/star锚点及tide/meadow board_safe_zone缺失属于receipt提示，本次未独立核验。spawn_outside语义需澄清。

室内TEST-REPORT标Cocos Creator3.8.x但状态not_run，receipt已撤回版本确定性。没有Cocos精确patch、实际导入、微信设备、音频codec/包体、B单位校准或角色动作验收证据。现有固定种子逻辑证据不扩展为这些验收结论。

## 可追溯来源

- 室内ZIP：https://drive.google.com/file/d/1EY4gzR7AsPr_v-e-TjujgkaUnzyf4VVL/view
- MIG receipt：https://drive.google.com/file/d/1wmCJMwPdhGXaxyf3TC3LpkDXvaLWEY9h/view
- ART receipt：https://drive.google.com/file/d/12ZdZyJnfnzR04doc5FCjgpQ5Ji-1Muf1/view
- A至F工程交接：https://drive.google.com/file/d/1fWACke-tlAu1iOpUJn_aA-KXf71AXVI2/view?usp=drivesdk

