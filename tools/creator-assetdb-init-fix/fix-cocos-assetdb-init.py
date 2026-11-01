#!/usr/bin/env python3
"""一次性修复 macOS Creator 3.8.8 的 AssetDB 初始化竞态；支持原字节回滚。"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

ORIGINAL_SHA256 = "b14f2084c411da514f8857db7de8c37179a5e7c899cf7387e45a18306985fddd"
MANAGER_SHA256 = "546691b7639c3434b06e708922a337edf6d691f34ff004ceba7cd75c57d83612"
MANAGER = "builtin/asset-db/dist/worker/asset-db-manager.ccc"
BRIDGE = "builtin/asset-db/dist/worker/asset-db-manager.js"
BRIDGE_SOURCE = Path(__file__).with_name("cocos-assetdb-init-bridge.cjs")


def digest(file):
    h = hashlib.sha256()
    with Path(file).open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_header(stream):
    stream.seek(0)
    prefix = stream.read(16)
    if len(prefix) != 16:
        raise ValueError("ASAR 头不完整")
    tag, header_size, payload_size, json_size = struct.unpack("<4I", prefix)
    if tag != 4 or header_size != payload_size + 4 or not 0 < json_size <= payload_size - 4:
        raise ValueError("ASAR 头格式不支持")
    raw = prefix + stream.read(header_size - 8)
    if len(raw) != header_size + 8:
        raise ValueError("ASAR 头被截断")
    return json.loads(raw[16:16 + json_size]), raw


def parent_entry(tree, path):
    parts = path.split("/")
    for part in parts[:-1]:
        tree = tree["files"][part]
    return tree["files"], parts[-1]


def read_entry(stream, tree, base, path):
    parent, name = parent_entry(tree, path)
    entry = parent[name]
    if entry.get("unpacked") or "link" in entry:
        raise ValueError("目标入口必须位于 ASAR 内")
    stream.seek(base + int(entry["offset"]))
    data = stream.read(entry["size"])
    if len(data) != entry["size"]:
        raise ValueError("ASAR 入口被截断")
    return data


def encode_header(tree):
    data = json.dumps(tree, ensure_ascii=False, separators=(",", ":")).encode()
    padding = bytes((-len(data)) % 4)
    payload_size = 4 + len(data) + len(padding)
    return struct.pack("<4I", 4, payload_size + 4, payload_size, len(data)) + data + padding


def rewrite(archive, header, source_offset, source_length, appendix=b""):
    fd, name = tempfile.mkstemp(prefix=".assetdb-init-", suffix=".asar", dir=archive.parent)
    candidate = Path(name)
    try:
        with os.fdopen(fd, "wb") as out, archive.open("rb") as src:
            out.write(header)
            src.seek(source_offset)
            remaining = source_length
            while remaining:
                chunk = src.read(min(8 * 1024 * 1024, remaining))
                if not chunk:
                    raise ValueError("ASAR 数据被截断")
                out.write(chunk)
                remaining -= len(chunk)
            out.write(appendix)
            out.flush()
            os.fsync(out.fileno())
        shutil.copymode(archive, candidate)
        return candidate
    except BaseException:
        candidate.unlink(missing_ok=True)
        raise


def apply(archive, bridge, original_sha=ORIGINAL_SHA256, manager_sha=MANAGER_SHA256):
    archive = Path(archive)
    receipt = archive.with_name(archive.name + ".assetdb-init-fix.json")
    current_sha = digest(archive)
    with archive.open("rb") as stream:
        tree, header = read_header(stream)
        original_manager = read_entry(stream, tree, len(header), MANAGER)
        if hashlib.sha256(original_manager).hexdigest() != manager_sha:
            raise ValueError("Creator AssetDB 实现不匹配，未修改安装包")
        parent, name = parent_entry(tree, BRIDGE)
        if name in parent:
            if read_entry(stream, tree, len(header), BRIDGE) != bridge:
                raise ValueError("已有不同的 worker JS 入口，拒绝覆盖")
            if not receipt.exists() or json.loads(receipt.read_text())["patchedSha256"] != current_sha:
                raise ValueError("补丁回滚记录缺失或安装包已改变")
            return "already-installed"
    if current_sha != original_sha:
        raise ValueError("仅支持已验证的官方 Creator 3.8.8 安装包，未修改文件")
    if receipt.exists():
        raise ValueError("存在旧补丁记录，请先检查或回滚")
    original_size = archive.stat().st_size
    bridge_sha = hashlib.sha256(bridge).hexdigest()
    parent[name] = {
        "size": len(bridge), "offset": str(original_size - len(header)),
        "integrity": {"algorithm": "SHA256", "hash": bridge_sha,
                      "blockSize": 4194304, "blocks": [bridge_sha]},
    }
    candidate = rewrite(archive, encode_header(tree), len(header), original_size - len(header), bridge)
    try:
        state = {
            "version": 1, "originalSha256": current_sha, "originalSize": original_size,
            "originalHeader": base64.b64encode(header).decode(),
            "patchedSha256": digest(candidate), "bridgeSha256": bridge_sha,
        }
        # 仅保存原 ASAR 头；资源及缓存无需备份，原数据完整保留于新 ASAR。
        with receipt.open("x") as out:
            json.dump(state, out, separators=(",", ":"))
            out.flush()
            os.fsync(out.fileno())
        os.replace(candidate, archive)
    finally:
        candidate.unlink(missing_ok=True)
    return "installed"


def restore(archive):
    archive = Path(archive)
    receipt = archive.with_name(archive.name + ".assetdb-init-fix.json")
    state = json.loads(receipt.read_text())
    current_sha = digest(archive)
    if current_sha == state["originalSha256"]:
        receipt.unlink()
        return "already-restored"
    if current_sha != state["patchedSha256"]:
        raise ValueError("安装包在修复后发生改变，拒绝回滚覆盖")
    original_header = base64.b64decode(state["originalHeader"], validate=True)
    with archive.open("rb") as stream:
        _, current_header = read_header(stream)
    candidate = rewrite(archive, original_header, len(current_header),
                        state["originalSize"] - len(original_header))
    try:
        if digest(candidate) != state["originalSha256"]:
            raise ValueError("回滚内容校验失败，原安装包未修改")
        os.replace(candidate, archive)
        receipt.unlink()
    finally:
        candidate.unlink(missing_ok=True)
    return "restored"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app", type=Path, help="CocosCreator.app 的绝对路径")
    parser.add_argument("--restore", action="store_true", help="恢复修复前完全相同的 ASAR 字节")
    args = parser.parse_args()
    app = args.app.resolve(strict=True)
    executable = str(app / "Contents/MacOS/CocosCreator")
    processes = subprocess.check_output(["ps", "-axo", "command="], text=True)
    if any(line.strip() == executable or line.strip().startswith(executable + " ")
           for line in processes.splitlines()):
        raise RuntimeError("请先退出这个 Creator 实例，避免运行中替换安装包")
    archive = app / "Contents/Resources/app.asar"
    result = restore(archive) if args.restore else apply(archive, BRIDGE_SOURCE.read_bytes())
    print(f"[asset-db-init-fix] {result}: {app}")


if __name__ == "__main__":
    main()
