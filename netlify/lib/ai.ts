import { CATEGORIES, CATEGORY_LABELS, type Question, type RoundType, type Settings } from '../../src/shared/types';
import { validateQuestions } from '../../src/shared/questionSchema';
import { questionNeeds, TIEBREAK_SPARES } from '../../src/shared/engine';

const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });

// Strict JSON schema for OpenAI structured outputs (every key required, no extras).
const QUESTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id', 'roundType', 'category', 'prompt', 'promptSelf', 'answerFormat', 'options',
          'matchingRule', 'discussionPrompt', 'sensitivity', 'statementType', 'correctAnswer',
        ],
        properties: {
          id: { type: 'string' },
          roundType: { type: 'string', enum: ['partner_prediction', 'same_answer', 'true_false_match', 'discussion'] },
          category: { type: 'string', enum: [...CATEGORIES] },
          prompt: { type: 'string' },
          promptSelf: nullable({ type: 'string' }),
          answerFormat: { type: 'string', enum: ['multiple_choice', 'yes_no', 'scale_1_5', 'short_text', 'true_false', 'who'] },
          options: { type: 'array', items: { type: 'string' } },
          matchingRule: { type: 'string', enum: ['exact', 'normalised_or_confirm', 'none'] },
          discussionPrompt: { type: 'string' },
          sensitivity: { type: 'string', enum: ['general', 'spicy'] },
          statementType: nullable({ type: 'string', enum: ['objective', 'subjective'] }),
          correctAnswer: nullable({ type: 'string', enum: ['True', 'False'] }),
        },
      },
    },
  },
};

const TONES: Record<Settings['tone'], string> = {
  silly: 'Playful and silly — aim for laughs and ridiculous-but-relatable scenarios.',
  debate: 'Debate-worthy — questions where both answers are defensible and couples will argue their case.',
  gentle: 'Light and less personal — easy, warm questions nobody could feel awkward about.',
};

const SYSTEM = `You write original questions for a couples party quiz played by four couples (eight adult friends) on holiday, drinks in hand.
The fun is in the reveal and the conversation afterwards, not in getting it "right".

Round types:
- partner_prediction: "prompt" asks about "your partner" (read by the guesser); "promptSelf" asks the same thing in second person (answered by the partner about themselves). Never use answerFormat "who".
- same_answer: both partners answer the same prompt about the two of them. "who" format = pick one of the two partners by name (e.g. "Who is more likely to...?"). promptSelf null.
- true_false_match: a short statement; answerFormat "true_false"; statementType "objective" (fun, verifiable, well-known fact; set correctAnswer) or "subjective" (pure opinion; correctAnswer null). Mix roughly half and half. promptSelf null.
- discussion: open debate with 3-4 multiple_choice options, no right answer. promptSelf null.

Rules:
- Original wording. Never copy questions from the commercial "Mr & Mrs" game.
- Gender-neutral: always "your partner", never husband/wife/he/she.
- Understandable instantly when read aloud; under 160 characters.
- Prefer multiple_choice (3-4 short, distinct, equally tempting options under 40 chars). Use short_text sparingly, yes_no and scale_1_5 occasionally.
- No answer should be embarrassing or "wrong". No secrets, exes, attractiveness, sexual history, money amounts people earn or owe, health, weight, religion, politics or trauma.
- options must be [] for yes_no, scale_1_5, true_false, who and short_text.
- discussionPrompt: one short, cheeky follow-up line that gets the table talking.
- matchingRule: "exact" except short_text ("normalised_or_confirm") and discussion ("none").
- ids: short kebab-case, unique.`;

export interface GenerateOptions {
  settings: Settings;
  avoidPrompts: string[];
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export function requestCounts(settings: Settings): Record<RoundType, number> {
  const needs = questionNeeds(settings.length);
  const out = {} as Record<RoundType, number>;
  for (const [type, n] of Object.entries(needs) as [RoundType, number][]) out[type] = Math.ceil(n * 1.5);
  out.same_answer += TIEBREAK_SPARES;
  return out;
}

function userPrompt(settings: Settings, avoid: string[]): string {
  const counts = requestCounts(settings);
  const cats = settings.categories.filter((c) => settings.spicy || c !== 'spicy_safe').map((c) => CATEGORY_LABELS[c]);
  return [
    `Write exactly these questions:`,
    ...Object.entries(counts).map(([t, n]) => `- ${n} × ${t}`),
    `Spread them across these categories: ${cats.join(', ')}.`,
    `Tone: ${TONES[settings.tone]}`,
    settings.spicy
      ? 'The host enabled "Spicy but Safe": a few cheeky, innuendo-level adult jokes are fine (mark them sensitivity "spicy"), nothing explicit.'
      : 'Keep everything friendly (sensitivity "general").',
    avoid.length ? `Do not repeat or closely paraphrase any of these:\n${avoid.map((p) => `- ${p}`).join('\n')}` : '',
  ].join('\n');
}

async function callOpenAI(opts: GenerateOptions): Promise<unknown[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000);
  try {
    const reasoning = /^(gpt-5|o\d)/.test(opts.model) ? { reasoning: { effort: 'low' } } : {};
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model,
        ...reasoning,
        max_output_tokens: 16000,
        input: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userPrompt(opts.settings, opts.avoidPrompts) },
        ],
        text: { format: { type: 'json_schema', name: 'question_batch', strict: true, schema: QUESTION_JSON_SCHEMA } },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[] };
    const text = body.output?.find((o) => o.type === 'message')?.content?.find((c) => c.type === 'output_text')?.text;
    if (!text) throw new Error('OpenAI returned no text');
    const parsed = JSON.parse(text) as { questions?: unknown };
    if (!Array.isArray(parsed.questions)) throw new Error('OpenAI JSON missing questions array');
    return parsed.questions;
  } finally {
    clearTimeout(timer);
  }
}

/** Generate + validate a batch. One retry on failure or a thin batch. Throws if nothing usable. */
export async function generateQuestions(opts: GenerateOptions): Promise<Question[]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callOpenAI(opts);
      const { valid, rejected } = validateQuestions(raw, 'ai', opts.avoidPrompts);
      if (rejected.length) console.warn('AI questions rejected', rejected);
      // Namespace ids so they can never collide with bank ids.
      const batch = valid.map((q, i) => ({ ...q, id: `ai-${Date.now().toString(36)}-${i}` }));
      if (batch.length >= 10 || attempt === 1) {
        if (!batch.length) throw new Error('No valid AI questions');
        return batch;
      }
      lastError = new Error(`Only ${batch.length} valid questions`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI generation failed');
}
