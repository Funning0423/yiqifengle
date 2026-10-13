# 原用户问题：QF-BOARD-FREEZE-20261013

用户原话：『然后还有就是棋盘那里啊，一直是卡住的，就点进棋盘的时候滑动不了，拖动不了那个道具。』

该问题独立保留，不被新自动化报告替换。用户手机反馈仍需真机复验；本轮本地 Chromium 的发现只能证明一条对应的恢复档路径。

本轮基线：6df6021f5e58d7ad60c4f352104f72621a4b6cc2；正式入口 WorldR5Integration.scene。

已真实观察：全新档关闭首次道具介绍后，交换与道具拖放可用。退出棋盘后重新进入，控制器恢复为 run.paused，画面没有 PausePanel / Resume，真实道具 touch-start 不取得指针，也没有消耗或动作写入。原 MainlineHost 注释要求恢复档保留暂停，由 view 提供显式 Resume；棋盘 presentForPlay 未安排该恢复界面。

修复范围：只在恢复暂停档正式显示时安排 PausePanel。保留显式继续、原记录和暂停状态，不自动提交动作、不改用户存档，不改角色和模型资产。不是重复 stage6 touch-cancel / getEventCode 适配。

真实基线证据：output/playwright/formal-input-baseline.json、formal-input-baseline-reentry.png。首次教学遮挡的额外现场：formal-input-intro-covered.json；它不是恢复档根因。
