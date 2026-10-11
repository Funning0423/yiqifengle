// Stand-in for ManagedMobileBoardUI (combo tests): the members GameAudio/CheerText/T0 read (hostPresentation, hostModalOpen, root, cells, layoutInfo).
import {Component} from 'cc';
export class ManagedMobileBoardUI extends Component{constructor(){super();this.snapshot={state:'run.intro'};this.modal=false;this.root=null;this.cells=[];this.layoutInfo=null;}
 hostPresentation(){return this.snapshot;} hostModalOpen(){return this.modal;} diagnostics(){return {state:this.snapshot.state};}}
