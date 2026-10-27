import { afterEach, describe, expect, it, vi } from 'vitest';
import bankJson from '../../src/data/questionBank.json';
import { DEFAULT_SETTINGS } from '../../src/shared/engine';
import { generateQuestions, requestCounts } from './ai';

const reply = (questions: unknown[]) =>
  new Response(JSON.stringify({ output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ questions }) }] }] }));

const fresh = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ ...bankJson.game[0], id: `q${i}`, prompt: `Brand new question number ${i} about your partner?` }));

const opts = { settings: DEFAULT_SETTINGS, avoidPrompts: bankJson.game.map((g) => g.prompt), apiKey: 'test', model: 'gpt-5-mini' };

afterEach(() => vi.unstubAllGlobals());

describe('generateQuestions', () => {
  it('parses, validates, dedupes against the bank and namespaces ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply([...fresh(12), bankJson.game[1], { junk: true }]));
    vi.stubGlobal('fetch', fetchMock);
    const out = await generateQuestions(opts);
    expect(out).toHaveLength(12);
    expect(out.every((q) => q.id.startsWith('ai-') && q.source === 'ai')).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text.format.strict).toBe(true);
    expect(body.reasoning.effort).toBe('low');
  });

  it('retries once on API error, then throws', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('nope', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateQuestions(opts)).rejects.toThrow(/OpenAI 500/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks for 1.5x what a game needs plus tie-break spares', () => {
    expect(requestCounts(DEFAULT_SETTINGS)).toEqual({ partner_prediction: 17, same_answer: 12, true_false_match: 9, discussion: 3 });
  });
});
