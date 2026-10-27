import { z } from 'zod';
import { ANSWER_FORMATS, CATEGORIES, ROUND_TYPES, type Question } from './types';
import { normaliseText } from './normalise';

export const rawQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  roundType: z.enum(ROUND_TYPES),
  category: z.enum(CATEGORIES),
  prompt: z.string().trim().min(8).max(220),
  promptSelf: z.string().trim().min(8).max(220).nullable(),
  answerFormat: z.enum(ANSWER_FORMATS),
  options: z.array(z.string().trim().min(1).max(60)).max(4),
  matchingRule: z.enum(['exact', 'normalised_or_confirm', 'none']),
  discussionPrompt: z.string().trim().min(4).max(220),
  sensitivity: z.enum(['general', 'spicy']),
  statementType: z.enum(['objective', 'subjective']).nullable(),
  correctAnswer: z.enum(['True', 'False']).nullable(),
});

export type RawQuestion = z.infer<typeof rawQuestionSchema>;

// Topics the spec rules out: secrets, attractiveness comparisons, sexual history, finances, trauma.
const BANNED = /\b(ex|exes|ex-partner|cheat\w*|affair|sex\w*|naked|nude|salary|salaries|debt|earn\w*|income|weight|fat|attractive\w*|hotter|ugl\w*|trauma\w*|abuse\w*|died|death|funeral|divorce\w*|secret\w*|jealous\w*|religio\w*|politic\w*)\b/i;

const FIXED_OPTIONS: Partial<Record<Question['answerFormat'], string[]>> = {
  yes_no: ['Yes', 'No'],
  scale_1_5: ['1', '2', '3', '4', '5'],
  true_false: ['True', 'False'],
  who: [],
  short_text: [],
};

/** Coerce a parsed question into canonical shape, or return a rejection reason. */
export function canonicalise(raw: RawQuestion, source: 'bank' | 'ai'): Question | string {
  const q: Question = { ...raw, source };

  if (BANNED.test(`${q.prompt} ${q.promptSelf ?? ''} ${q.discussionPrompt} ${q.options.join(' ')}`)) {
    return 'unsuitable topic';
  }

  if (q.roundType === 'true_false_match') {
    q.answerFormat = 'true_false';
    if (!q.statementType) return 'true/false needs statementType';
    if (q.statementType === 'objective' && !q.correctAnswer) return 'objective statement needs correctAnswer';
    if (q.statementType === 'subjective') q.correctAnswer = null;
  } else {
    if (q.answerFormat === 'true_false') return 'true_false format only for true_false_match';
    q.statementType = null;
    q.correctAnswer = null;
  }

  if (q.roundType === 'partner_prediction') {
    if (!q.promptSelf) return 'partner_prediction needs promptSelf';
    if (q.answerFormat === 'who') return '"who" format makes no sense for predictions';
  } else {
    q.promptSelf = null;
  }

  const fixed = FIXED_OPTIONS[q.answerFormat];
  if (fixed) {
    q.options = [...fixed];
  } else {
    const keys = new Set(q.options.map(normaliseText));
    if (q.options.length < 2 || keys.size !== q.options.length) return 'multiple_choice needs 2-4 distinct options';
  }

  q.matchingRule =
    q.roundType === 'discussion' ? 'none' : q.answerFormat === 'short_text' ? 'normalised_or_confirm' : 'exact';
  return q;
}

export interface ValidationResult {
  valid: Question[];
  rejected: { id: string; reason: string }[];
}

/** Validate untrusted question data; dedupes against itself and `seenPrompts` (normalised). */
export function validateQuestions(input: unknown[], source: 'bank' | 'ai', seenPrompts: Iterable<string> = []): ValidationResult {
  const seen = new Set([...seenPrompts].map(normaliseText));
  const ids = new Set<string>();
  const out: ValidationResult = { valid: [], rejected: [] };

  for (const item of input) {
    const parsed = rawQuestionSchema.safeParse(item);
    const id = (item as { id?: unknown })?.id;
    if (!parsed.success) {
      out.rejected.push({ id: String(id ?? '?'), reason: parsed.error.issues[0]?.message ?? 'invalid' });
      continue;
    }
    const q = canonicalise(parsed.data, source);
    if (typeof q === 'string') {
      out.rejected.push({ id: parsed.data.id, reason: q });
      continue;
    }
    const key = normaliseText(q.prompt);
    if (seen.has(key) || ids.has(q.id)) {
      out.rejected.push({ id: q.id, reason: 'duplicate' });
      continue;
    }
    seen.add(key);
    ids.add(q.id);
    out.valid.push(q);
  }
  return out;
}
