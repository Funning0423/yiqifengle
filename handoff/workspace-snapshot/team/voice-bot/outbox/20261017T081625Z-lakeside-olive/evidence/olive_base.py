import sys,json;sys.path.insert(0,'.')
from opt_land import *
V=json.load(open('final_land.json'));x=json.load(open('final_water.json'))
WA2=dict(p33.W33,main=x[0],amb=x[1],sky_strength=x[2],floor=x[3])
GH=json.load(open('ground_half.json'))
def P_now(): P=P_of(V,WA2);P['ground_byte']=lin255(GH);return P
inv={v:k for k,v in G['ids'].items()}
def palbyte(G): return np.round(emu.tex_byte(G['alb'])*255).astype(int)
