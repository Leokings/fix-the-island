import type { WorldSnapshot } from '../domain/world';

/** Synthesized effects. AudioContext is created/resumed only by the Sound button. */
export class GameAudio {
  private context: AudioContext | null = null;
  private enabled = false;
  private owner: object | null = null;
  private previous: WorldSnapshot | null = null;
  private footstep = 0;
  private events = 0;
  async toggle(): Promise<boolean> {
    if (this.enabled) { this.enabled=false; await this.context?.suspend(); return false; }
    this.context ??= new AudioContext();
    await this.context.resume();this.enabled=this.context.state==='running';
    if(this.enabled)this.play('snap');return this.enabled;
  }
  play(kind:'snap'|'fail'|'pass'|'finish'|'step'):void {
    if(!this.enabled||this.context?.state!=='running')return;
    const frequencies=kind==='finish'?[392,494,587]:kind==='pass'?[440,554]:kind==='fail'?[164,146]:kind==='step'?[100]:[660];
    const gain=kind==='step'?.015:kind==='fail'?.025:.04;
    frequencies.forEach((frequency,i)=>{
      const oscillator=this.context!.createOscillator(),envelope=this.context!.createGain(),time=this.context!.currentTime+i*.12;
      oscillator.type=kind==='step'?'triangle':'sine';oscillator.frequency.setValueAtTime(frequency,time);
      envelope.gain.setValueAtTime(0,time);envelope.gain.linearRampToValueAtTime(gain,time+.008);envelope.gain.exponentialRampToValueAtTime(.0001,time+.14);
      oscillator.connect(envelope).connect(this.context!.destination);oscillator.start(time);oscillator.stop(time+.16);
    });this.events++;
  }
  update(snapshot:WorldSnapshot,owner:object,seconds:number):void {
    if(owner!==this.owner){this.owner=owner;this.previous=null;this.footstep=0;}
    if(this.previous&&!snapshot.paused)for(const site of snapshot.sites){
      const before=this.previous.sites.find(candidate=>candidate.id===site.id);
      if(before?.phase==='restoring'&&site.phase==='restored')this.play('finish');
      if(!before?.advice&&site.advice)this.play(site.advice.valid?'pass':'fail');
    }
    if(!snapshot.paused&&!snapshot.inspectionId&&Math.hypot(snapshot.player.velocity.x,snapshot.player.velocity.z)>.4){
      this.footstep+=Math.min(seconds,.1);if(this.footstep>.36){this.footstep=0;this.play('step');}
    }else this.footstep=0;
    this.previous=snapshot;
  }
  diagnostics():Readonly<{enabled:boolean;state:string;events:number}>{return{enabled:this.enabled,state:this.context?.state??'not-created',events:this.events};}
  dispose():void{this.enabled=false;void this.context?.close();}
}
