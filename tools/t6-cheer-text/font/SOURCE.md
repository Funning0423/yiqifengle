# Fredoka 位图字来源与许可（T6b）

- 字体：Fredoka（Milena Brandão, Hafontia），**SIL Open Font License 1.1**，许可全文见同目录 `OFL.txt`（来自同一提交，sha256 `5c9e7eee5c6b25f4b05b8d53b2e470ea4962f9ced742d044a98f7d95d1375bab`）。
- 来源：Google Fonts 官方仓库 `google/fonts`，提交 `a60a77e14f28abd4ef243a1b5dfc48df0cec5205`
  - https://raw.githubusercontent.com/google/fonts/a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf
  - 版本：`Version 2.001`（name ID 5；head.fontRevision 2.001）；可变字体，轴 wght 300–700、wdth 75–125
  - sha256：`2ba02e68b152868aef9ba28e24b3648c7d457fe6f25c761f2c2c53fb61a73fc8`（159 184 B；生成脚本会校验）
- TTF **不进仓库、不进包**。进包的只有由它烘焙出的 `creator-build-project/assets/resources/ui/cheer-font/cheer-fredoka.{fnt,png}`（19 个字形的位图），属于 OFL 允许的衍生使用；`OFL.txt` 和本说明只放在 `tools/`，不进包。
- 烘焙参数：实例 wght 600 / wdth 100（SemiBold），38 px，4× 超采样后盒式降采样，白色填充、仅 alpha，pngquant 16 级 + optipng。
- 重新生成（结果逐字节一致，uuid 固定）：
  ```sh
  curl -LO 'https://raw.githubusercontent.com/google/fonts/a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf'
  python3 tools/t6-cheer-text/font/gen-bmfont.py 'Fredoka[wdth,wght].ttf' creator-build-project/assets/resources/ui/cheer-font
  ```
  需要 Pillow、numpy、fontTools、pngquant、optipng。
