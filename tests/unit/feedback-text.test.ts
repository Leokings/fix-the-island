import { describe, expect, it } from 'vitest';
import { wholeSentences } from '../../src/domain/feedback-text';

describe('council feedback trimmed by the contract', () => {
  it('cuts the live pump feedback back to its last whole sentence', () => {
    const live = 'While the direct_pump design meets the village water supply need (pressure:4, trunkFlow:6), it fails to control pressure and protect the sensitive creekside habitat. The high withdrawal rate, noise, and resultant habitat pressure conflict d';
    expect(live.length).toBe(240);
    expect(wholeSentences(live)).toBe('While the direct_pump design meets the village water supply need (pressure:4, trunkFlow:6), it fails to control pressure and protect the sensitive creekside habitat.');
  });
  it('cuts a v5 rehearsal sentence trimmed at 160 back to its last whole word', () => {
    const v5 = 'Shutting the habitat outlet contradicts the steady-habitat valve and starves the habitat; describe how both village and habitat keep their shares in a dry spell';
    expect(v5.length).toBe(160);
    expect(wholeSentences(v5)).toBe('Shutting the habitat outlet contradicts the steady-habitat valve and starves the habitat; describe how both village and habitat keep their shares in a dry…');
  });
  it('leaves short or complete feedback alone', () => {
    expect(wholeSentences('Assessment recorded.')).toBe('Assessment recorded.');
    const complete = `${'A careful build. '.repeat(14)}Done.`.trim();
    expect(wholeSentences(complete)).toBe(complete);
  });
  it('falls back to the last whole word when there is no early sentence end', () => {
    const run = `${'word '.repeat(47)}words`;
    expect(run.length).toBe(240);
    const out = wholeSentences(run);
    expect(out.endsWith('word…')).toBe(true);
  });
});
