import { describe, expect, it } from 'vitest';
import bankJson from '../data/questionBank.json';
import { BANK, BANK_TIEBREAK } from './bank';
import {
  applyHost,
  applyPlayer,
  computeResult,
  createGame,
  GameError,
  questionNeeds,
  replaceCurrentQuestion,
  selectQuestions,
  startGame,
  toPublic,
} from './engine';
import { validateQuestions } from './questionSchema';
import type { Expect, GameState, Question } from './types';

const couples = [
  { name: 'Reds', players: ['Ann', 'Ben'] as [string, string] },
  { name: 'Yellows', players: ['Cat', 'Dan'] as [string, string] },
  { name: 'Teals', players: ['Eve', 'Fin'] as [string, string] },
  { name: 'Purples', players: ['Gus', 'Hal'] as [string, string] },
];

const seeded = () => {
  let x = 42;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
};

function newGame(length: 'standard' | 'quick' = 'quick'): GameState {
  const g = createGame('g1', 'ABCD', couples, { length });
  return startGame(g, selectQuestions(g.settings, [], BANK, BANK_TIEBREAK, seeded()));
}

const ex = (s: GameState): Expect => ({ phase: s.phase, roundIndex: s.roundIndex, qIndex: s.qIndex });
const q = (s: GameState) => s.questions[s.run!.questionId];

/** Every player answers; `pick(playerIndexInCouple, coupleIndex)` chooses the option index. */
function answerAll(s: GameState, pick: (j: number, i: number) => number): GameState {
  const question = q(s);
  s.couples.forEach((c, i) =>
    c.playerIds.forEach((pid, j) => {
      const opts = question.answerFormat === 'who' ? c.playerIds : question.options.length ? question.options : ['pizza', 'Pizza ', 'tacos'];
      s = applyPlayer(s, pid, { type: 'answer', value: opts[pick(j, i) % opts.length] });
    }),
  );
  return s;
}

function revealAll(s: GameState): GameState {
  for (let i = 0; i < s.couples.length; i++) s = applyHost(s, { type: 'reveal_next', expect: ex(s) });
  return s;
}

describe('question bank', () => {
  it('every bank question validates', () => {
    expect(BANK).toHaveLength(bankJson.game.length);
    expect(BANK_TIEBREAK).toHaveLength(bankJson.tiebreak.length);
    expect(BANK.length).toBe(25);
  });
  it('covers a full standard game', () => {
    const needs = questionNeeds('standard');
    for (const [type, n] of Object.entries(needs)) expect(BANK.filter((b) => b.roundType === type).length).toBeGreaterThanOrEqual(n);
  });
});

describe('validation', () => {
  const good = { ...bankJson.game[0] };
  it('rejects malformed, duplicate and unsuitable questions', () => {
    const res = validateQuestions(
      [
        good,
        { ...good, id: 'dupe' },
        { ...good, id: 'bad', roundType: 'nope' },
        { ...good, id: 'ex', prompt: 'What would your partner say about their ex?' },
        { ...good, id: 'opts', options: ['Only one'] },
        { ...good, id: 'noself', promptSelf: null },
        'garbage',
      ],
      'ai',
    );
    expect(res.valid.map((v) => v.id)).toEqual([good.id]);
    expect(res.rejected).toHaveLength(6);
  });
  it('requires correctAnswer for objective statements', () => {
    const tf = bankJson.game.find((g) => g.statementType === 'objective')!;
    expect(validateQuestions([{ ...tf, correctAnswer: null }], 'ai').valid).toHaveLength(0);
  });
});

describe('scoring', () => {
  const couple = { id: 'c1', name: 'x', colour: 'tomato' as const, playerIds: ['a', 'b'] as [string, string] };
  const tf = (statementType: 'objective' | 'subjective', correct: 'True' | 'False' | null): Question =>
    ({ ...BANK.find((b) => b.roundType === 'true_false_match')!, statementType, correctAnswer: correct });

  it('true/false objective: 2 for true match, 1 for false match, 0 when agreed wrong', () => {
    expect(computeResult(tf('objective', 'True'), couple, { a: 'True', b: 'True' }).points).toBe(2);
    expect(computeResult(tf('objective', 'False'), couple, { a: 'False', b: 'False' }).points).toBe(1);
    expect(computeResult(tf('objective', 'False'), couple, { a: 'True', b: 'True' })).toMatchObject({ status: 'agreed_wrong', points: 0 });
  });
  it('true/false subjective: 2 for any agreement, never "wrong"', () => {
    expect(computeResult(tf('subjective', null), couple, { a: 'False', b: 'False' })).toMatchObject({ status: 'match', points: 2 });
    expect(computeResult(tf('subjective', null), couple, { a: 'True', b: 'False' }).points).toBe(0);
  });
  it('short text: normalised match auto-scores, otherwise host confirms', () => {
    const st = BANK.find((b) => b.answerFormat === 'short_text')!;
    expect(computeResult(st, couple, { a: 'The Spa Day!', b: 'spa day' }).points).toBe(1);
    expect(computeResult(st, couple, { a: 'spa', b: 'massage' }).status).toBe('needs_confirm');
  });
  it('skip and discussion give 0', () => {
    const mc = BANK.find((b) => b.answerFormat === 'multiple_choice' && b.roundType !== 'discussion')!;
    expect(computeResult(mc, couple, { a: null, b: mc.options[0] }).status).toBe('skipped');
    const dd = BANK.find((b) => b.roundType === 'discussion')!;
    expect(computeResult(dd, couple, { a: dd.options[0], b: dd.options[0] }).points).toBe(0);
  });
});

describe('game flow', () => {
  it('plays a full quick game end to end', () => {
    let s = newGame();
    let guard = 0;
    while (s.phase !== 'game_complete' && guard++ < 200) {
      if (s.phase === 'round_intro') s = applyHost(s, { type: 'start_round', expect: ex(s) });
      else if (s.phase === 'question_open') s = answerAll(s, (_j, i) => (i === 0 ? 0 : _j)); // couple 1 always matches
      else if (s.phase === 'answers_locked') s = revealAll(s);
      else if (s.phase === 'reveal') {
        for (const c of s.couples)
          if (s.run!.results[c.id].status === 'needs_confirm') s = applyHost(s, { type: 'confirm', expect: ex(s), coupleId: c.id, match: false });
        s = applyHost(s, { type: 'next', expect: ex(s) });
      } else if (s.phase === 'round_complete') s = applyHost(s, { type: 'next', expect: ex(s) });
    }
    expect(s.phase).toBe('game_complete');
    const pub = toPublic(s);
    expect(pub.awards!.winners).toEqual(['c1']);
    expect(pub.standings[0].coupleId).toBe('c1');
  });

  it('auto-locks once all eight answer, and blocks late answers', () => {
    let s = applyHost(newGame(), { type: 'start_round', expect: { phase: 'round_intro', roundIndex: 0, qIndex: 0 } });
    s = answerAll(s, () => 0);
    expect(s.phase).toBe('answers_locked');
    expect(() => applyPlayer(s, 'p1', { type: 'answer', value: q(s).options[0] })).toThrow(GameError);
  });

  it('partner prediction roles swap each question', () => {
    let s = applyHost(newGame(), { type: 'start_round', expect: ex(newGame()) });
    const first = s.run!.subjectByCouple.c1;
    s = applyHost(s, { type: 'skip_question', expect: ex(s) });
    expect(s.run!.subjectByCouple.c1).not.toBe(first);
  });

  it('double-tapped host actions are rejected as stale (no double scoring)', () => {
    let s = applyHost(newGame(), { type: 'start_round', expect: ex(newGame()) });
    s = answerAll(s, () => 0);
    s = revealAll(s);
    const stale = ex(s);
    s = applyHost(s, { type: 'next', expect: stale });
    const before = toPublic(s).scores;
    expect(() => applyHost(s, { type: 'next', expect: stale })).toThrow(/out of date/);
    expect(toPublic(s).scores).toEqual(before);
    expect(Object.values(before).every((v) => v === 1)).toBe(true);
  });

  it('auto-locks when every joined player has answered', () => {
    let s = applyHost(newGame(), { type: 'start_round', expect: ex(newGame()) });
    s.players.forEach((p) => (p.claimed = p.id === 'p1' || p.id === 'p2'));
    s = applyPlayer(s, 'p1', { type: 'answer', value: q(s).options[0] });
    expect(s.phase).toBe('question_open');
    s = applyPlayer(s, 'p2', { type: 'answer', value: q(s).options[0] });
    expect(s.phase).toBe('answers_locked');
  });

  it('host can force-lock with missing answers (missing = skipped)', () => {
    let s = applyHost(newGame(), { type: 'start_round', expect: ex(newGame()) });
    s = applyPlayer(s, 'p1', { type: 'answer', value: q(s).options[0] });
    s = applyHost(s, { type: 'lock', expect: ex(s) });
    expect(s.run!.results.c1.status).toBe('skipped');
  });

  it('hides answers and correct answer until reveal', () => {
    let s = newGame();
    // jump to the true/false round
    while (s.rounds[s.roundIndex].type !== 'true_false_match' || s.phase !== 'round_intro') {
      if (s.phase === 'round_intro') s = applyHost(s, { type: 'start_round', expect: ex(s) });
      else if (s.phase === 'question_open') s = applyHost(s, { type: 'skip_question', expect: ex(s) });
      else s = applyHost(s, { type: 'next', expect: ex(s) });
    }
    s = applyHost(s, { type: 'start_round', expect: ex(s) });
    s = applyPlayer(s, 'p1', { type: 'answer', value: 'True' });
    const open = toPublic(s);
    expect(open.question!.correctAnswer).toBeNull();
    expect(JSON.stringify(open)).not.toContain('"p1":"True"');
    expect(open.submitted).toEqual(['p1']);
    expect(open.revealed).toEqual([]);
  });

  it('scores only count for revealed couples', () => {
    let s = applyHost(newGame(), { type: 'start_round', expect: ex(newGame()) });
    s = answerAll(s, () => 0);
    s = applyHost(s, { type: 'reveal_next', expect: ex(s) });
    const sc = toPublic(s).scores;
    expect(sc.c1).toBe(1);
    expect(sc.c2).toBe(0);
  });

  it('adds a tie-break round when the top is tied', () => {
    let s = newGame();
    let guard = 0;
    while (s.phase !== 'game_complete' && !s.rounds[s.roundIndex]?.tiebreak && guard++ < 200) {
      if (s.phase === 'round_intro') s = applyHost(s, { type: 'start_round', expect: ex(s) });
      else if (s.phase === 'question_open') s = applyHost(s, { type: 'skip_question', expect: ex(s) });
      else s = applyHost(s, { type: 'next', expect: ex(s) });
    }
    expect(s.rounds[s.roundIndex].tiebreak).toBe(true);
    expect(s.phase).toBe('round_intro');
  });

  it('replaces an unanswered question but not an answered one', () => {
    let s = applyHost(newGame(), { type: 'start_round', expect: ex(newGame()) });
    const spare = BANK.filter((b) => b.roundType === 'partner_prediction').find((b) => !s.questions[b.id])!;
    const r = replaceCurrentQuestion(s, spare);
    expect(r.run!.questionId).toBe(spare.id);
    s = applyPlayer(s, 'p1', { type: 'answer', value: q(s).options[0] });
    expect(() => replaceCurrentQuestion(s, spare)).toThrow();
  });
});
