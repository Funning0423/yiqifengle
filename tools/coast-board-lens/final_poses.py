#!/usr/bin/env python3
"""Item 3 final (Grok Bot ruling (i)): per-screen board pose, look point and pitch fixed (dz 0), distance = shortest at which the
new margin rule holds against the screen's own keep-out bands. Bands: h<=600 portrait -> c2d10462 compact ([0,131] / SPEC 3.5
tool top); otherwise the current HUD (BoardLayout + topNoGo = hint banner bottom; tool hot-zone top = toolsY-32)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import keepout_r2 as K
SCREENS=['390x844','414x896','360x780','375x667','320x568','390x520','768x1024']
COMPACT={'320x568':(131,474),'390x520':(131,426)}
def current(w,h):
    pauseY=67;plateBottom=pauseY+29+60;toolsY=h-34-80;trayBottomMax=toolsY-52
    pitch=max(20,min(42.6*min(1.3,max(1,w/390)),(w-18)/(681/82),(trayBottomMax-plateBottom-44)/(723/82)));k=pitch/42.6;trayH=pitch*723/82
    trayTop=min(plateBottom+max(56*k,44)+trayH/2,trayBottomMax-trayH/2)-trayH/2
    return (round(min((plateBottom+trayTop)/2,trayTop-22)+16,1),toolsY-32)
def band(w,h): return COMPACT[f'{w}x{h}'] if (w<h*1.1 and h<=600) else current(w,h)
if __name__=='__main__':
    out={}
    for s in SCREENS:
        w,h=map(int,s.split('x'));b=band(w,h);r=K.full(0.0,w,h,b);r['band_kind']='compact' if h<=600 else 'current';out[s]=r
        print(s,r['band_kind'],b,r['distance_m'],r['pos'],r['far_short_pt'],r['far_cell_height_pt'],r['wrong_taps'],r['gap_left'],r['gap_right'],r['gap_top'],r['gap_bottom'],r['face_gap_tool'],r['face_gap_top'],r['pass'])
    json.dump(out,open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'final_poses.json'),'w'),indent=1)
