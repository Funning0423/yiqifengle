import sys,json,subprocess,numpy as np,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
x=np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',sys.argv[1],'-ac','1','-f','f32le','-'],stdout=subprocess.PIPE).stdout,np.float32)
h=441;r=np.sqrt(np.convolve(x**2,np.ones(h*4)/(h*4),'same'))[::h];t=np.arange(len(r))/100
E=json.load(open(sys.argv[2]));fig,a=plt.subplots(figsize=(14,4.5),dpi=110)
a.plot(t,20*np.log10(r+1e-6),lw=.8);a.set_ylim(-60,-5);a.set_xlabel('s (frame/30)');a.set_ylabel('RMS dBFS')
for k,v,c in [('door 76',E['door'],'brown'),('peak 248',E['peak'],'r'),('walk end 260',E['walkEnd'],'k'),('crane 455',E['crane'],'m'),('settle/sail 599',E['settle'],'g')]:
  a.axvline(v,color=c,ls='--');a.text(v,-8,k,color=c,rotation=90,va='top',fontsize=8)
a.axvspan(*E['windFull'],color='orange',alpha=.2,label='full wind 448-503')
for s in E['steps']:a.axvline(s,color='gray',lw=.4,ymax=.08)
a.legend(loc='lower left');a.set_title('sfx_exit_outbound (B5.3, 19.967 s) envelope');fig.tight_layout();fig.savefig(sys.argv[3])
