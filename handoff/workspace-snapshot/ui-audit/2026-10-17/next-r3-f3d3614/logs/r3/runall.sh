cd ~/qfl-a3b/r3
bash lkrun.sh day day
bash lkrun.sh night night
URLQ='?lakemerge=off' TAG=_mergeoff bash lkrun.sh mo_day day
URLQ='?lakemerge=off' TAG=_mergeoff bash lkrun.sh mo_night night
bash lkrun.sh fail fail
QUICK=1 VW=360 VH=780 bash lkrun.sh v360 day
QUICK=1 VW=375 VH=667 bash lkrun.sh v375 day
QUICK=1 VW=390 VH=520 bash lkrun.sh v390s day
cd ~/qfl-a3b && sed -i '' 's#web-r2#web-r3#; s#r2rec#r3rec#g; s#r2srv#r3srv#g' run.sh && bash run.sh
echo RUNALL_DONE
