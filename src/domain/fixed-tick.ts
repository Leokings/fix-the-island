export const FIXED_SECONDS = 1 / 60;
export class FixedTick {
  private accumulator = 0;
  droppedSeconds = 0;
  advance(elapsedSeconds: number, tick: (dt: number) => void): { steps: number; alpha: number } {
    const elapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
    this.accumulator += Math.min(elapsed, 0.25);
    this.droppedSeconds += Math.max(0, elapsed - 0.25);
    let steps = 0;
    while (this.accumulator + 1e-9 >= FIXED_SECONDS && steps < 4) {
      tick(FIXED_SECONDS);
      this.accumulator -= FIXED_SECONDS;
      steps++;
    }
    if (this.accumulator >= FIXED_SECONDS) {
      const dropped = this.accumulator - this.accumulator % FIXED_SECONDS;
      this.droppedSeconds += dropped;
      this.accumulator -= dropped;
    }
    return { steps, alpha: Math.max(0, this.accumulator / FIXED_SECONDS) };
  }
}
