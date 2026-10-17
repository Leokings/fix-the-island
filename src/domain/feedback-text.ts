// Contracts store council feedback trimmed to a fixed length (240 in v4, 160 in
// v5), which can end
// mid-word. Show whole sentences: cut back to the last full stop when the text
// was trimmed, else to the last word with an ellipsis. Shorter text is unchanged.
export const FEEDBACK_LIMIT = 160;

export function wholeSentences(text: string, limit = FEEDBACK_LIMIT): string {
  const trimmed = text.trim();
  if (Array.from(trimmed).length < limit || /[.!?]["')\]]?$/.test(trimmed)) return trimmed;
  let end = -1;
  for (const match of trimmed.matchAll(/[.!?]["')\]]?(?=\s)/g)) end = match.index + match[0].length;
  if (end >= 40) return trimmed.slice(0, end);
  const space = trimmed.lastIndexOf(' ');
  return `${(space > 0 ? trimmed.slice(0, space) : trimmed).replace(/[\s,;:–-]+$/, '')}…`;
}
