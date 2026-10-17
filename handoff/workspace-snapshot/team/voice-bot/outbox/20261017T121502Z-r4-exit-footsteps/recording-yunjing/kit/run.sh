#!/bin/bash
# runs A,B,C sequentially (resumable); own http server on 8771; waits while another Cocos/Chrome harness runs
cd ~/lkcam-tmp/fs/kit; mkdir -p ~/lkcam-tmp/fs/runs
(cd ~/lkcam-tmp/fs/web && exec python3 -m http.server 8771 --bind 127.0.0.1 > ~/lkcam-tmp/fs/srv.log 2>&1) & SRV=$!
echo "srv $SRV" >> ~/lkcam-tmp/fs/run.log
export PWCORE=$HOME/node_modules/playwright/node_modules/playwright-core
for n in ${RUNS:-A_exit B_return C_gating}; do
  [ -f ~/lkcam-tmp/fs/runs/$n/meta.json ] && continue
  while pgrep -f "MacOS/CocosCreator " >/dev/null; do echo "$(date) creator busy, waiting" >> ~/lkcam-tmp/fs/run.log; sleep 20; done
  echo "$(date -u +%FT%TZ) start $n" >> ~/lkcam-tmp/fs/run.log
  rm -rf ~/lkcam-tmp/fs/runs/$n; node rec2.cjs ~/lkcam-tmp/fs/kit/$n.json > ~/lkcam-tmp/fs/runs/$n.out 2>&1
  echo "$(date -u +%FT%TZ) done $n $(tail -1 ~/lkcam-tmp/fs/runs/$n.out | cut -c1-160)" >> ~/lkcam-tmp/fs/run.log
done
kill $SRV; echo ALLDONE >> ~/lkcam-tmp/fs/run.log
