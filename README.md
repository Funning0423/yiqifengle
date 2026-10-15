# task21 751905c cloud handoff

Only the previously authorized 14 original files are transferred. Original total: 165,109,896 bytes. Source commit: `751905c985e4e0c898f395456c3b2a41ff7a1376`. The old frozen handoff commit `91bb5a4b28add90616e5db707663f5afce1a88f5` is preserved locally; this branch uses incremental transport commits with parts no larger than 1 MiB. Original file bytes and full SHA256 remain unchanged.

**The branch is incomplete until `TRANSFER-COMPLETE.json` exists.** The full manifest is published first so cloud readers can inspect the planned scope and hashes while transfers continue.

```sh
git clone --single-branch --branch handoff/task21-cloud-20261015 https://github.com/Funning0423/yiqifengle.git task21-cloud
cd task21-cloud
# If cloned before transfer completion:
git pull --ff-only
python3 reconstruct.py
```

The script verifies every part and every reconstructed original. Output goes under `reconstructed/`, preserving original relative paths. Extract `reconstructed/deliverables/task21-source.tar.gz` into a new `integrated-source/` directory. The separately supplied baseline GLB belongs at `integrated-source/evidence/offline-character/task21-baseline.glb`. Extract the package ZIP separately. The two supplied audit scripts retain their old Mac path layout; adapt the historical frame input path explicitly to the supplied `task20/evidence/native-all-observed-frames.json` in the cloud working copy.

Acceptance remains OPEN, not frozen: historical 2213-frame offline comparison failed 1760 -> 1602, gained pairs 0, lost 61180; native full-route visual acceptance is incomplete. Read the report, checkpoint and local sync diagnostic. Current user instruction prohibits further local WeChat developer-tool testing; follow-up testing is handled in the cloud/browser. No credentials, formal saved-game payloads or private Codex sessions are included. Do not change permissions or publish to WeChat.
