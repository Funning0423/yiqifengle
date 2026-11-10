#!/bin/bash
# wait until no other qf-lock-*, no DevTools, no Creator; then take /tmp/qf-lock-scene-fjord (atomic) and run $1. Max 3h.
. "$(dirname "$0")/common.sh"; mkdir -p $O; exec >> $O/waitlock.log 2>&1
echo "== waitlock start $(NOW) next=$1"
for i in $(seq 1 360); do
  OTHER=$(ls /tmp/qf-lock-* 2>/dev/null | grep -v "^$LK$")
  if [ -z "$OTHER" ] && [ "$(DT)" = 0 ] && ! pgrep -f "MacOS/CocosCreator " >/dev/null; then
    if (set -C; echo "$OWNER dir=$W pid=$$ start=$(date '+%F %T %Z')" > $LK) 2>/dev/null; then echo "LOCK TAKEN $(NOW)"; exec bash $W/$1; fi
  fi
  [ $((i % 20)) = 1 ] && echo "waiting $(NOW): other=[$OTHER] devtools=$(DT)"
  sleep 30
done
echo "GAVE UP $(NOW)"
