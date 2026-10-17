cd /tmp/b5
blender -b -t 4 -P render.py -- job_B5_075.json > vf/job_B5_075.log 2>&1 &
blender -b -t 4 -P render.py -- job_B4_075.json > vf/job_B4_075.log 2>&1 &
wait; echo ALLDONE
