import {Node} from 'cc';
export class GameAudio{static listeners=[];static node=null;
 static onCheer(l){GameAudio.listeners.push(l);return()=>{GameAudio.listeners=GameAudio.listeners.filter(x=>x!==l);};}
 static emitCheer(level,visual){for(const l of GameAudio.listeners.slice())l(level,visual);}
 static ensure(){if(!GameAudio.node)GameAudio.node=new Node('GameAudio');return {node:GameAudio.node};}}
