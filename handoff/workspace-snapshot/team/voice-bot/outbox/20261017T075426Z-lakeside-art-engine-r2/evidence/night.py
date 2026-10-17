import numpy as np
def s(c): c=np.clip(np.asarray(c,float),0,1); return np.where(c<=0.0031308,c*12.92,1.055*c**(1/2.4)-0.055)
q=lambda c:np.round(s(c)*255)/255   # old: linearToSrgb8 bytes -> Cocos reads as linear
lum=lambda c:float(np.dot([0.2126,0.7152,0.0722],c))
r5=dict(sun=[1,.6,.32],sky=[0.0116,0.2747,0.4793],gnd=[1,.5457,.1441])
new=dict(sun=[1,.6,.32],sky=[0.0107,0.0656,0.1106],gnd=[1,.841,.0687]); sd_new,ad_new=0.7,0.49
nt=dict(sun=[0.36,0.46,0.78],sky=[0.012,0.03,0.09],gnd=[0.02,0.022,0.04]); sn_old,an_old=1.0,0.6
# old day (shipped r2 before VB): sun 1.0, amb 0.75, srgb bytes
oD_sun=lum(q(r5['sun']))*1.0; oD_amb=0.5*(lum(q(r5['sky']))+lum(q(r5['gnd'])))*0.75
oN_sun=lum(q(nt['sun']))*sn_old; oN_amb=0.5*(lum(q(nt['sky']))+lum(q(nt['gnd'])))*an_old
nD_sun=lum(new['sun'])*sd_new; nD_amb=0.5*(lum(new['sky'])+lum(new['gnd']))*ad_new
sn=oN_sun/oD_sun*nD_sun/lum(nt['sun']); an=oN_amb/oD_amb*nD_amb/(0.5*(lum(nt['sky'])+lum(nt['gnd'])))
print('old eff night sun',q(nt['sun']).round(4),'sky',q(nt['sky']).round(4),'gnd',q(nt['gnd']).round(4))
print('ratios old night/day sun %.3f amb %.3f'%(oN_sun/oD_sun,oN_amb/oD_amb))
print('night sun scale %.3f ambient ratio %.3f'%(sn,an))
print('check new night/day sun %.3f amb %.3f'%(lum(nt['sun'])*sn/nD_sun,0.5*(lum(nt['sky'])+lum(nt['gnd']))*an/nD_amb))
print('amb/sun within night old %.3f new %.3f'%(oN_amb/oN_sun,0.5*(lum(nt['sky'])+lum(nt['gnd']))*an/(lum(nt['sun'])*sn)))
