import { describe, expect, it } from 'vitest';
import { councilVotes, modelName } from '../../src/genlayer/council/validator-votes';

// Shaped like the live StudioNet Pump review (0x5ab31323…), trimmed to the fields read.
const node = (model: string) => ({ node_config: { primary_model: { model } } });
const pumpReview = { consensus_data: {
  votes: {},
  leader_receipt: [{ mode: 'leader', vote: null, processing_time: 9673, ...node('policy:prd-deepseek') }],
  validators: [
    { mode: 'validator', vote: 'agree', processing_time: 2600, ...node('google/gemini-3-flash-preview') },
    { mode: 'validator', vote: 'agree', processing_time: 2737, ...node('policy:prd-gpt-5-4') },
    { mode: 'validator', vote: 'idle', processing_time: 0 },
    { mode: 'validator', vote: 'agree', processing_time: 4721, ...node('policy:prd-minimax') },
  ],
} };

describe('council votes from a finalized transaction', () => {
  it('reads the leader and each validator with a short model name', () => {
    expect(councilVotes(pumpReview)).toEqual({
      leader: { model: 'DeepSeek', ms: 9673 },
      validators: [
        { model: 'Gemini', vote: 'agree', ms: 2600 },
        { model: 'GPT-5.4', vote: 'agree', ms: 2737 },
        { model: null, vote: 'idle', ms: 0 },
        { model: 'MiniMax', vote: 'agree', ms: 4721 },
      ],
    });
  });
  it('names the model families seen on StudioNet', () => {
    expect(modelName('openai/gpt-5.4')).toBe('GPT-5.4');
    expect(modelName('anthropic/claude-sonnet-4.6')).toBe('Claude');
    expect(modelName('policy:prd-something-new')).toBe('something new');
    expect(modelName(undefined)).toBeNull();
  });
  it('carries when the review was submitted, when the transaction says', () => {
    expect(councilVotes({ ...pumpReview, created_at: '2026-10-16T11:55:03.716114+00:00' })?.at).toBe(Date.parse('2026-10-16T11:55:03.716Z'));
    expect(councilVotes(pumpReview)?.at).toBeUndefined();
  });
  it('returns null without consensus data and treats unknown votes as idle', () => {
    expect(councilVotes({})).toBeNull();
    expect(councilVotes({ consensus_data: { validators: [{ mode: 'validator', vote: 'weird' }] } })?.validators[0]?.vote).toBe('idle');
  });
});
