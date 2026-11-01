import json,sys
d=json.load(open(sys.argv[1])); R=d['rows']; tl=d['timeline']
print({k:tl[k] for k in ('LTOT','NF','f_touch','f_peak','theta_peak_deg','stop','warp','t_e','s_e')})
def mx(k,rows=R): v=[(r[k],r['f']) for r in rows if r.get(k) is not None]; return max(v) if v else None
def mn(k,rows=R): v=[(r[k],r['f']) for r in rows if r.get(k) is not None]; return min(v) if v else None
for k in ('basket_x_body','basket_x_dress','basket_x_apron','leafX_body','leafX_dress','leafX_apron','door_in_body','door_in_dress','door_in_apron','body_below_ground','ikerr_mm'): print(k,mx(k))
print('door_gap body/cloth min',mn('door_gap_body_mm'),mn('door_gap_cloth_mm'))
for sd in 'LR':
    print(sd,'sole min',mn('sole'+sd),'slide max',mx('slide'+sd))
    sv=sorted([(r['slide'+sd],r['f']) for r in R if r.get('slide'+sd) is not None],reverse=True)[:5]; print('  top slides',sv)
    # planted sole height (frames where foot is planted per GP: sole<12mm) max
    pl=[(r['sole'+sd],r['f']) for r in R if r.get('slide'+sd) is not None and r['slide'+sd]<1.0]; print('  planted sole max', max(pl) if pl else None)
    dk=[(round(R[i]['knee'+sd]-R[i+1]['knee'+sd],2),R[i]['f']) for i in range(len(R)-1)]; print('  max knee straighten /f',max(dk))
lo,hi=60,140
print('f seg s root GL GR soleL soleR slideL slideR kneeL kneeR footYL footYR')
for r in R[lo:hi]: print(r['f'],r['seg'],r['s'],r['root_mm'],r['GL'],r['GR'],r['soleL'],r['soleR'],r.get('slideL'),r.get('slideR'),r['kneeL'],r['kneeR'],r['footYL'],r['footYR'],r['body_below_ground'],r['basket_x_body'],r['basket_x_dress'])
