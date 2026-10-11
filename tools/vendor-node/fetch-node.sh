#!/usr/bin/env bash
# 下载并校验锁定的 Node 运行时到 tools/vendor-node/node-runtime/（git 忽略）。sha256 不符即删除并失败。
set -euo pipefail
D=$(cd "$(dirname "$0")" && pwd); V=$(python3 -c "import json;print(json.load(open('$D/node-version.json'))['version'])")
case "$(uname -s)-$(uname -m)" in Linux-x86_64) P=linux-x64;; Linux-aarch64) P=linux-arm64;; Darwin-arm64) P=darwin-arm64;; Darwin-x86_64) P=darwin-x64;; *) echo "unsupported platform"; exit 1;; esac
read -r F SHA < <(python3 -c "import json;a=json.load(open('$D/node-version.json'))['artifacts']['$P'];print(a['file'],a['sha256'])")
OUT=$D/node-runtime; BIN=$OUT/${F%.tar.*}/bin/node
if [ -x "$BIN" ] && [ "$("$BIN" -v)" = "v$V" ]; then echo "$BIN"; exit 0; fi
mkdir -p "$OUT"; TMP=$OUT/$F.part; curl -fsSL -o "$TMP" "https://nodejs.org/dist/v$V/$F"
GOT=$( (command -v sha256sum >/dev/null && sha256sum "$TMP" || shasum -a 256 "$TMP") | cut -d' ' -f1)
[ "$GOT" = "$SHA" ] || { rm -f "$TMP"; echo "SHA256 MISMATCH for $F: $GOT != $SHA" >&2; exit 1; }
tar xf "$TMP" -C "$OUT"; rm -f "$TMP"; [ "$("$BIN" -v)" = "v$V" ]; echo "$BIN"
