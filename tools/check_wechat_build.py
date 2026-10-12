#!/usr/bin/env python3
"""0001c build gate (GGbot). Usage: python3 check_wechat_build.py <wechat build output dir> [required bundles...]
Exit 0 = pass, 1 = fail. Read-only; touches nothing."""
import json, os, sys
out = sys.argv[1]; need = sys.argv[2:] or ["resources", "region_island"]
gj = json.load(open(os.path.join(out, "game.json")))
subs = gj.get("subpackages", []); roots = [s["root"].rstrip("/") for s in subs]; names = [s.get("name") for s in subs]
def size(p):
    if os.path.isfile(p): return os.path.getsize(p)
    return sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(p) for f in fs)
total = size(out); sub = {r: size(os.path.join(out, r)) for r in roots}; main = total - sum(sub.values())
missing = [n for n in need if n not in names]
print(json.dumps({"subpackages": names, "subpackageBytes": sub, "mainBytes": main, "totalBytes": total, "missing": missing}, indent=2))
ok = True
if missing: print("FAIL: game.json subpackages missing", missing); ok = False
if main > 4_000_000: print(f"FAIL: main package {main} > 4,000,000 bytes"); ok = False
if total > 30 * 1024 * 1024: print("FAIL: total > 30M"); ok = False
import re
def build_sha():
    """BUILD_SHA as compiled into the output (tools/write_build_info.cjs stamps it before the build)."""
    pat = re.compile(r"BUILD_SHA\W{1,40}?['\"]([0-9a-f]{7}(?:-dirty)?|dev)['\"]")
    for r, _, fs in os.walk(out):
        for f in fs:
            if not f.endswith(".js"): continue
            try: m = pat.search(open(os.path.join(r, f), encoding="utf-8", errors="ignore").read())
            except OSError: continue
            if m: return m.group(1)
    return None
sha = build_sha(); print(json.dumps({"buildSha": sha}))
if sha is None: print("WARN: BUILD_SHA not found in the build output (about page label unchecked)")
elif sha == "dev": print("WARN: BuildInfo.ts not stamped; run node tools/write_build_info.cjs before the build")
print("PASS" if ok else "STOP: do not open DevTools"); sys.exit(0 if ok else 1)
