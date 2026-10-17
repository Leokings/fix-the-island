import type { CouncilVote, CouncilVotes } from '../types';

// Display only. Reads who took part in a finalized review from the transaction's
// consensus data: the leader (whose output the contract stored) and each
// validator's vote and AI model. GenLayer does not store validators' own reasoning,
// so nothing here invents it. The contract receipt alone decides the outcome.

const MAX_VALIDATORS = 16;

const FAMILIES: readonly [RegExp, string][] = [
  [/deepseek/i, 'DeepSeek'], [/gemini/i, 'Gemini'], [/claude|anthropic/i, 'Claude'],
  [/gpt[-_ ]?(\d+(?:[.-]\d+)?)/i, 'GPT'], [/minimax/i, 'MiniMax'], [/llama/i, 'Llama'],
  [/qwen/i, 'Qwen'], [/mistral/i, 'Mistral'], [/grok/i, 'Grok'], [/kimi|moonshot/i, 'Kimi'],
];

/** A short model name for the council tag, e.g. "policy:prd-gpt-5-4" → "GPT-5.4". */
export function modelName(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  for (const [pattern, name] of FAMILIES) {
    const match = raw.match(pattern);
    if (!match) continue;
    return name === 'GPT' && match[1] ? `GPT-${match[1].replace('-', '.')}` : name;
  }
  const last = raw.split(/[/:]/).pop()!.replace(/^prd-/, '').replace(/[-_]+/g, ' ').trim();
  return last ? last.slice(0, 16) : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function model(receipt: Record<string, unknown>): string | null {
  const primary = record(record(receipt.node_config)?.primary_model);
  return modelName(primary?.model);
}
function ms(receipt: Record<string, unknown>): number {
  const value = Number(receipt.processing_time);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}
function vote(value: unknown): CouncilVote {
  const v = typeof value === 'string' ? value.toLowerCase() : '';
  return v === 'agree' || v === 'disagree' || v === 'timeout' ? v : 'idle';
}

/** The review's council, or null when the transaction has no readable consensus data. */
export function councilVotes(tx: unknown): CouncilVotes | null {
  const data = record(record(tx)?.consensus_data);
  if (!data) return null;
  const leaderValue = Array.isArray(data.leader_receipt) ? data.leader_receipt[0] : data.leader_receipt;
  const leaderReceipt = record(leaderValue);
  const leader = leaderReceipt ? Object.freeze({ model: model(leaderReceipt), ms: ms(leaderReceipt) }) : null;
  const rows = Array.isArray(data.validators) ? data.validators : [];
  const validators = rows.slice(0, MAX_VALIDATORS).flatMap(row => {
    const r = record(row);
    if (!r || r.mode === 'leader') return [];
    const v = vote(r.vote);
    return [Object.freeze({ model: v === 'idle' ? null : model(r), vote: v, ms: v === 'idle' ? 0 : ms(r) })];
  });
  if (!leader && !validators.length) return null;
  const created = Date.parse(String(record(tx)?.created_at ?? ''));
  return Object.freeze({ leader, validators: Object.freeze(validators), ...(Number.isFinite(created) ? { at: created } : {}) });
}
