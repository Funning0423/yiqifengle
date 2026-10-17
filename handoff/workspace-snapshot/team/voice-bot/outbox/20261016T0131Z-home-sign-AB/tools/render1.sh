#!/bin/bash
# render1.sh variant wt W H view
cd /tmp/vbsign; t=fin/$1_$5_$3x$4
NODE_PATH=/tmp/ggts/node_modules node gen.cjs $2 $3 $4 $5 > $t.json && blender -b --factory-startup -P bl.py -- $t.json /tmp/vbsign/$t 1 > $t.log 2>&1 && python3 comp.py $t $t.json $t.png && echo OK $t
