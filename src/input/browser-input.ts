import type { Command, WorldSnapshot } from '../domain/world';
import { getRepairScenario } from '../genlayer';

export class BrowserInput {
  private readonly held = new Set<string>();
  private readonly commands: Command[] = [];
  private stick = { right: 0, up: 0 };
  private readonly cleanups: (() => void)[] = [];
  private context:WorldSnapshot|null=null;
  constructor(joystick: HTMLElement, interact: HTMLElement) {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches('input,textarea,[contenteditable]')) return;
      const code = event.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'Escape', 'KeyE'].includes(code)) event.preventDefault();
      this.held.add(code);
      if (!event.repeat && code === 'KeyE') this.commands.push({ kind: 'Inspect' });
      if (!event.repeat && code === 'Escape') { this.clear(); this.commands.push({ kind: 'Pause' }); }
      const editor=this.context?.editor,siteId=this.context?.inspectionId;
      if(!event.repeat&&editor&&siteId) {
        const fixture=getRepairScenario(siteId);
        if(code==='KeyR')this.commands.push({kind:'RotatePart'});
        if(code==='KeyF')this.commands.push({kind:'SetDetent'});
        if(code==='KeyT')this.commands.push({kind:'TestDraft'});
        if(code==='KeyC')this.commands.push({kind:'Tab',tab:'connect'});
        if(code==='Enter'&&!(event.target instanceof HTMLButtonElement))this.commands.push({kind:'PlacePart'});
        if(code==='BracketLeft'||code==='BracketRight') {
          event.preventDefault();const i=fixture.slotIds.indexOf(editor.slotId);
          this.commands.push({kind:'SelectSlot',slotId:fixture.slotIds[(i+(code==='BracketRight'?1:fixture.slotIds.length-1))%fixture.slotIds.length]!});
        }
        if(/^Digit[1-6]$/.test(code)) {
          const options=fixture.options.filter((o)=>o.allowedSlots?.includes(editor.slotId)),option=options[Number(code.slice(5))-1];
          if(option)this.commands.push({kind:'SelectOption',optionId:option.id});
        }
      }
    };
    const up = (event: KeyboardEvent) => this.held.delete(event.code);
    const clear = () => this.clear();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    this.cleanups.push(() => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); });
    let pointer: number | null = null;
    const update = (event: PointerEvent) => {
      const rect = joystick.getBoundingClientRect();
      const right = (event.clientX - rect.left - rect.width / 2) / (rect.width * 0.38);
      const up = -(event.clientY - rect.top - rect.height / 2) / (rect.height * 0.38);
      const length = Math.max(1, Math.hypot(right, up));
      this.stick = { right: right / length, up: up / length };
    };
    const start = (event: PointerEvent) => { pointer = event.pointerId; joystick.setPointerCapture(pointer); update(event); };
    const move = (event: PointerEvent) => { if (pointer === event.pointerId) update(event); };
    const end = () => { pointer = null; this.stick = { right: 0, up: 0 }; };
    const inspect = () => this.commands.push({ kind: 'Inspect' });
    joystick.addEventListener('pointerdown', start); joystick.addEventListener('pointermove', move);
    joystick.addEventListener('pointerup', end); joystick.addEventListener('pointercancel', end); joystick.addEventListener('lostpointercapture', end);
    interact.addEventListener('click', inspect);
    this.cleanups.push(() => { joystick.removeEventListener('pointerdown', start); joystick.removeEventListener('pointermove', move); joystick.removeEventListener('pointerup', end); joystick.removeEventListener('pointercancel', end); joystick.removeEventListener('lostpointercapture', end); interact.removeEventListener('click', inspect); });
  }
  sample(): readonly Command[] {
    const has = (...codes: string[]) => codes.some((code) => this.held.has(code)) ? 1 : 0;
    const movement: Command = { kind: 'Move', right: has('KeyD', 'ArrowRight') - has('KeyA', 'ArrowLeft') + this.stick.right,
      up: has('KeyW', 'ArrowUp') - has('KeyS', 'ArrowDown') + this.stick.up, brisk: this.held.has('ShiftLeft') || this.held.has('ShiftRight') };
    return [movement, ...this.commands.splice(0)];
  }
  enqueue(command: Command): void { this.commands.push(command); }
  setContext(snapshot:WorldSnapshot):void {this.context=snapshot;}
  clear(): void { this.held.clear(); this.stick = { right: 0, up: 0 }; }
  dispose(): void { for (const cleanup of this.cleanups) cleanup(); this.clear(); }
}
