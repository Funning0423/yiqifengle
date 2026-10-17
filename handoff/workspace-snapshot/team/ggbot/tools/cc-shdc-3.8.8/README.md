# Cocos Creator 3.8.8 effect compiler (offline)
- `shdc-lib.js`, `index.js`, `utils.js`: unmodified from the 3.8.8 editor app.asar (modules/engine-extensions/extensions/engine-extends/static/effect-compiler/), copied from /workspace/e4/tools/cc-effect-compiler.
- `offline-mappings.js`: bundled from engine/editor/exports/offline-mappings.ts of the same install.
- `engine/editor/assets/chunks`: cocos-engine tag 3.8.8 (commit 411f98df047c25902f93440d4b22925c2fb65461), editor/assets/chunks.
- `node_modules`: glsl-parser, glsl-tokenizer, js-yaml@3 from npm (shdc-lib dependencies).
Usage: `node compile.js engine <file.effect> [out.json]` (run from this dir) or `require('./compile.js').make(<this>/engine)`.
