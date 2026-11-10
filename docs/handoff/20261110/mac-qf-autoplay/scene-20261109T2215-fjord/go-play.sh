#!/bin/bash
D="$(dirname "$0")"; mkdir -p "$D/out/run1"; for s in "$D"/out/s-fj-*; do [ -d "$s" ] && mv "$s" "$D/out/run1/"; done
MYLS=localstorage_3f9c540e23e0456940e972ae08da83aa.json PHASE=play exec bash "$D/go.sh"
