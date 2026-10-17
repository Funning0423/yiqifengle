#!/bin/bash
# Regenerate handoff/workspace-snapshot from /workspace/wechat-game (idempotent)
set -e
cd /workspace/handoff-prep
python3 select.py > select.out
python3 -c "
import json;d=json.load(open('sel.json'))
open('inc.txt','w').write('\n'.join(p for p,_ in d['inc'])+'\n')
"
S=/tmp/wt-handoff/handoff/workspace-snapshot
rm -rf "$S"; mkdir -p "$S"
cd /workspace/wechat-game && tar -cf - -T /workspace/handoff-prep/inc.txt | tar -xf - -C "$S"
mkdir -p "$S/_box-tmp" && cp -a /tmp/amb "$S/_box-tmp/amb"
cd "$S"
rg -uu -l '/Users/[^/<]+' -g '!*.patch' . > /workspace/handoff-prep/redacted_files.txt || true
[ -s /workspace/handoff-prep/redacted_files.txt ] && xargs -d '\n' perl -pi -e 's#/Users/[^/<]+\b#/Users/<mac-user>#g' < /workspace/handoff-prep/redacted_files.txt
cat /workspace/handoff-prep/select.out
echo "redacted files: $(wc -l < /workspace/handoff-prep/redacted_files.txt)"
du -sh "$S"
