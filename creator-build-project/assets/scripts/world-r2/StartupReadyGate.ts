/** A startup attempt owns every late asynchronous result. No timers or resource progress estimates. */
export class StartupCancelled extends Error { constructor(){super('Startup attempt is no longer current');} }
export interface StartupAttempt { readonly id:number; check():void; }
export class StartupReadyGate {
  private generation=0;private pending:Promise<void>|null=null;private disposed=false;
  private phase:'idle'|'loading'|'ready'|'error'|'disposed'='idle';private failure:string|null=null;
  snapshot(){return {phase:this.phase,attempt:this.generation,error:this.failure};}
  run(prepare:(attempt:StartupAttempt)=>Promise<void>):Promise<void>{
    if(this.disposed)return Promise.reject(new StartupCancelled());
    if(this.pending)return this.pending;if(this.phase==='ready')return Promise.resolve();
    const id=++this.generation;this.phase='loading';this.failure=null;
    const attempt:StartupAttempt={id,check:()=>{if(this.disposed||id!==this.generation)throw new StartupCancelled();}};
    // Defer prepare until pending has been assigned, including synchronously reentrant callers.
    const pending=Promise.resolve().then(()=>prepare(attempt)).then(()=>{attempt.check();this.phase='ready';},error=>{if(!this.disposed&&id===this.generation){this.phase='error';this.failure=String(error);}throw error;}).finally(()=>{if(this.pending===pending)this.pending=null;});
    this.pending=pending;return pending;
  }
  dispose(){this.disposed=true;this.generation++;this.phase='disposed';}
}
