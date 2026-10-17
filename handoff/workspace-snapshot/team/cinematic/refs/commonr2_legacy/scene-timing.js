'use strict';
const standSource=1.1,standDisplay=1.75,extra=standDisplay-standSource,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function segment(t,d,h,m0,m1){const u=clamp(t/d,0,1),u2=u*u,u3=u2*u;return(u3-2*u2+u)*d*m0+(-2*u3+3*u2)*h+(u3-u2)*d*m1;}
function turnClock(t){const v=.375/1.485,I=u=>u*u*u*u*(2.5+u*(-3+u));if(t<.12)return v*.12*I(t/.12);const a=.06*v;if(t<1.47)return a+v*(t-.12);const x=t-1.47;return a+1.35*v+v*x+(1-v)*.15*I(x/.15);}
function stand(t){if(t<=1.1)return segment(t,1.1,.65,.15,0);return .65+segment(t-1.1,.65,.45,.45,.8);}
// Keep a calm cadence through the whole indoor approach, not just step one.
const indoorRate=.8,launchExtra=0;
function launch(t){return .8*t;}
const reachStart=standDisplay+(3.95-standSource)/.8,reachEnd=reachStart+.85,releaseStart=reachEnd+(5.28-4.55)/.8,releaseEnd=releaseStart+.8,exitRampEnd=releaseEnd+1.2,outExtra=exitRampEnd-(5.9+1.155);
function out(t){if(t<=standDisplay)return stand(t);if(t<reachStart)return standSource+launch(t-standDisplay);if(t<reachEnd)return 3.95+segment(t-reachStart,.85,.60,.8,.8);if(t<releaseStart)return 4.55+(t-reachEnd)*.8;if(t<releaseEnd)return 5.28+segment(t-releaseStart,.8,.62,.8,.8);if(t<exitRampEnd)return 5.9+segment(t-releaseEnd,1.2,1.155,.8,1);return t-outExtra;}
function displayTime(source){let a=0,b=18+outExtra;for(let i=0;i<60;i++){const m=(a+b)/2;if(out(m)<source)a=m;else b=m;}return(a+b)/2;}
function home(t,sourceDuration=6){const start=sourceDuration-standSource,displayDuration=sourceDuration+extra;t=clamp(t,0,displayDuration);return t<=start?t:sourceDuration-stand(displayDuration-t);}
module.exports={displayTime,indoorRate,launchExtra,standSource,standDisplay,extra,out,home,outExtra,fixedDuration:displayTime(6.4),movingDuration:18+outExtra};
