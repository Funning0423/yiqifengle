'use strict';
// N1: at night the meadow journey/region keeps meadow_sky_dome on as a night-only sky with SkyNightTexture (nightBlend 1);
// by day it stays off (old path). WorldFlowComponent.applyDayNight toggles it. Cocos doubles only, not a render.
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHarness}=require('./board-ui/harness.cjs');
const H=createHarness(),A=H.load('region/RegionJourneyAdapter'),cc=H.cc;
const mk=()=>{const root=new cc.Node('meadow');const dome=new cc.Node('meadow_sky_dome');root.addChild(dome);const r=dome.addComponent(cc.MeshRenderer);
 const props={};r.getMaterialInstance=()=>({setProperty:(k,v)=>{props[k]=v;},getProperty:k=>props[k],passes:[]});return {root,dome,r,props};};
{const m=mk();const sky=A.mountMeadowNightSky(m.root,true);assert(sky,'component');assert.equal(sky.skyRenderer,m.r);assert.equal(m.r.enabled,true,'night: dome on');assert.equal(m.props.nightBlend,1);assert.equal(sky.__qfNightOnly,true);}
{const m=mk();A.mountMeadowNightSky(m.root,false);assert.equal(m.r.enabled,false,'day: dome off as before');assert.equal(m.props.nightBlend,0);}
{const m=mk();globalThis.__worldDayNight={snapshot:()=>({mode:'night'})};A.mountMeadowNightSky(m.root);assert.equal(m.r.enabled,true,'reads the world day/night');delete globalThis.__worldDayNight;}
assert.equal(A.mountMeadowNightSky(new cc.Node('x'),true),null,'no dome: no-op');
const adapter=fs.readFileSync('creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts','utf8');assert(/mountMeadowNightSky\(model\);/.test(adapter),'journey mount calls it');
const wf=fs.readFileSync('creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts','utf8');assert(/__qfNightOnly&&sky\.skyRenderer\?\.isValid\)sky\.skyRenderer\.enabled=view\.skyNightBlend>0/.test(wf),'day/night toggle drives the dome');
console.log('PASS meadow night sky: night dome + SkyNightTexture, day unchanged, toggle wired');
