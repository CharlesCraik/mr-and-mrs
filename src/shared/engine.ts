import { normaliseText } from './normalise';
import {
  CATEGORIES,
  COUPLE_COLOURS,
  type Awards,
  type Couple,
  type CoupleResult,
  type Expect,
  type GameState,
  type HostAction,
  type PlayerAction,
  type PublicSnapshot,
  type Question,
  type QuestionRun,
  type RoundPlan,
  type RoundType,
  type Settings,
  type Standing,
} from './types';

export class GameError extends Error {
  constructor(
    public code: 'stale' | 'invalid' | 'locked' | 'not_found' | 'taken',
    message: string,
  ) {
    super(message);
  }
}

export const DEFAULT_SETTINGS: Settings = {
  length: 'standard',
  aiMode: false,
  tone: 'silly',
  categories: CATEGORIES.filter((c) => c !== 'spicy_safe'),
  spicy: false,
  allowEdits: true,
};

interface RoundTemplate {
  type: RoundType;
  title: string;
  blurb: string;
  scoring: string;
}

export const ROUND_TEMPLATES: RoundTemplate[] = [
  {
    type: 'partner_prediction',
    title: 'How Well Do You Know Your Partner?',
    blurb: 'One of you answers for yourself, the other guesses what they said. Roles swap every question.',
    scoring: '1 point for a correct guess',
  },
  {
    type: 'same_answer',
    title: 'Same Answer',
    blurb: 'You both answer the same question at the same time. Great minds think alike... right?',
    scoring: '1 point when your answers match',
  },
  {
    type: 'partner_prediction',
    title: 'Know Your Partner: The Sequel',
    blurb: 'Back to guessing — new questions, same chance to be smug.',
    scoring: '1 point for a correct guess',
  },
  {
    type: 'true_false_match',
    title: "It's a Match",
    blurb: 'True or false? Agree with each other to score. Some are facts, some are pure opinion.',
    scoring: 'Opinion: 2 pts for agreeing. Fact: 2 pts agreeing on a true one, 1 pt on a false one',
  },
  {
    type: 'discussion',
    title: 'Bonus: The Group Debate',
    blurb: 'No right answers, no points. Pick a side and defend it to the table.',
    scoring: 'Just for fun — no points',
  },
];

export const ROUND_COUNTS: Record<Settings['length'], number[]> = {
  standard: [6, 6, 5, 6, 2],
  quick: [3, 3, 3, 3, 1],
};

/** How many questions of each round type a game needs (plus tie-break spares). */
export function questionNeeds(length: Settings['length']): Record<RoundType, number> {
  const needs: Record<RoundType, number> = { partner_prediction: 0, same_answer: 0, true_false_match: 0, discussion: 0 };
  ROUND_TEMPLATES.forEach((t, i) => (needs[t.type] += ROUND_COUNTS[length][i]));
  return needs;
}

export const TIEBREAK_SPARES = 3;

const clone = <T>(v: T): T => structuredClone(v);

// ---------- Setup ----------

export interface CoupleInput {
  name: string;
  players: [string, string];
}

export function createGame(id: string, roomCode: string, couples: CoupleInput[], settings: Partial<Settings> = {}): GameState {
  if (couples.length < 2 || couples.length > 4) throw new GameError('invalid', 'Need 2–4 couples');
  const state: GameState = {
    id,
    roomCode,
    phase: 'lobby',
    paused: false,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    couples: [],
    players: [],
    questions: {},
    rounds: [],
    reserve: [],
    roundIndex: 0,
    qIndex: 0,
    run: null,
    history: [],
    adjustments: [],
    aiNote: null,
    aiStatus: 'off',
    aiPool: [],
    generations: 0,
  };
  couples.forEach((c, i) => {
    const coupleId = `c${i + 1}`;
    const ids: [string, string] = [`p${i * 2 + 1}`, `p${i * 2 + 2}`];
    state.couples.push({
      id: coupleId,
      name: c.name.trim() || `Couple ${i + 1}`,
      colour: COUPLE_COLOURS[i],
      playerIds: ids,
    });
    ids.forEach((pid, j) =>
      state.players.push({ id: pid, name: c.players[j]?.trim() || `Player ${i * 2 + j + 1}`, coupleId, claimed: false }),
    );
  });
  return state;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Choose questions for every round. `preferred` (e.g. AI-generated) are used first,
 * then `fallback` (the bank). Category/spicy settings are honoured where possible.
 */
export function selectQuestions(
  settings: Settings,
  preferred: Question[],
  fallback: Question[],
  fallbackSpares: Question[],
  rng: () => number = Math.random,
): { rounds: RoundPlan[]; reserve: Question[]; questions: Question[] } {
  const used = new Set<string>();
  const usedPrompts = new Set<string>();
  const allowed = (q: Question) => (settings.spicy || q.sensitivity !== 'spicy') && (settings.spicy || q.category !== 'spicy_safe');
  const inCats = (q: Question) => settings.categories.includes(q.category);
  const take = (pool: Question[], type: RoundType, n: number): Question[] => {
    const out: Question[] = [];
    const candidates = pool.filter((q) => q.roundType === type && allowed(q));
    const ordered = [...shuffle(candidates.filter(inCats), rng), ...shuffle(candidates.filter((q) => !inCats(q)), rng)];
    for (const q of ordered) {
      if (out.length >= n) break;
      const key = normaliseText(q.prompt);
      if (used.has(q.id) || usedPrompts.has(key)) continue;
      used.add(q.id);
      usedPrompts.add(key);
      out.push(q);
    }
    return out;
  };

  const counts = ROUND_COUNTS[settings.length];
  const questions: Question[] = [];
  const rounds: RoundPlan[] = ROUND_TEMPLATES.map((t, i) => {
    const picked = take(preferred, t.type, counts[i]);
    picked.push(...take(fallback, t.type, counts[i] - picked.length));
    questions.push(...picked);
    return { ...t, questionIds: picked.map((q) => q.id) };
  }).filter((r) => r.questionIds.length > 0);

  const reserve = take(preferred, 'same_answer', TIEBREAK_SPARES);
  reserve.push(...take([...fallbackSpares, ...fallback], 'same_answer', TIEBREAK_SPARES - reserve.length));
  questions.push(...reserve);
  return { rounds, reserve, questions };
}

export function startGame(state: GameState, plan: { rounds: RoundPlan[]; reserve: Question[]; questions: Question[] }, aiNote: string | null = null): GameState {
  if (state.phase !== 'lobby') throw new GameError('stale', 'Game already started');
  if (!plan.rounds.length) throw new GameError('invalid', 'No questions available');
  const s = clone(state);
  s.questions = Object.fromEntries(plan.questions.map((q) => [q.id, q]));
  s.rounds = plan.rounds;
  s.reserve = plan.reserve.map((q) => q.id);
  s.roundIndex = 0;
  s.qIndex = 0;
  s.run = null;
  s.history = [];
  s.adjustments = [];
  s.phase = 'round_intro';
  s.aiNote = aiNote;
  return s;
}

// ---------- Scoring ----------

export function computeResult(q: Question, couple: Couple, answers: Record<string, string | null>): CoupleResult {
  if (q.roundType === 'discussion') return { status: 'no_score', points: 0, reason: 'Just for fun — no points' };
  const [a, b] = couple.playerIds.map((id) => answers[id] ?? null);
  if (a === null || b === null) return { status: 'skipped', points: 0, reason: 'Skipped — no points, no shame' };

  if (q.roundType === 'true_false_match') {
    if (a !== b) return { status: 'no_match', points: 0, reason: 'Split decision!' };
    if (q.statementType === 'subjective') return { status: 'match', points: 2, reason: 'Opinion question — you agree, 2 points' };
    if (a === q.correctAnswer) {
      return a === 'True'
        ? { status: 'match', points: 2, reason: 'Agreed, and it IS true — 2 points' }
        : { status: 'match', points: 1, reason: 'Agreed, and it IS false — 1 point' };
    }
    return { status: 'agreed_wrong', points: 0, reason: `You agreed... but it's actually ${q.correctAnswer?.toLowerCase()}!` };
  }

  const label = q.roundType === 'partner_prediction' ? 'Nailed the guess' : 'Same answer';
  if (q.answerFormat === 'short_text') {
    if (normaliseText(a) === normaliseText(b)) return { status: 'match', points: 1, reason: `${label} — 1 point` };
    return { status: 'needs_confirm', points: 0, reason: 'Close enough? Host decides' };
  }
  return a === b ? { status: 'match', points: 1, reason: `${label} — 1 point` } : { status: 'no_match', points: 0, reason: 'No match — talk it out!' };
}

function lockRun(s: GameState): void {
  const run = s.run!;
  const q = s.questions[run.questionId];
  for (const c of s.couples) run.results[c.id] = computeResult(q, c, run.answers);
  s.phase = 'answers_locked';
}

export function scoreTotals(state: GameState): { total: Record<string, number>; byRound: Record<string, number[]> } {
  const total: Record<string, number> = {};
  const byRound: Record<string, number[]> = {};
  for (const c of state.couples) {
    total[c.id] = 0;
    byRound[c.id] = state.rounds.map(() => 0);
  }
  const add = (run: QuestionRun, coupleId: string) => {
    const pts = run.results[coupleId]?.points ?? 0;
    total[coupleId] += pts;
    if (byRound[coupleId][run.roundIndex] !== undefined) byRound[coupleId][run.roundIndex] += pts;
  };
  for (const run of state.history) for (const c of state.couples) add(run, c.id);
  if (state.run && state.phase === 'reveal') {
    state.couples.slice(0, state.run.revealCursor).forEach((c) => add(state.run!, c.id));
  }
  for (const adj of state.adjustments) if (adj.coupleId in total) total[adj.coupleId] += adj.delta;
  return { total, byRound };
}

export function standings(state: GameState): Standing[] {
  const { total } = scoreTotals(state);
  const sorted = [...state.couples].sort((a, b) => total[b.id] - total[a.id]);
  return sorted.map((c) => ({
    coupleId: c.id,
    score: total[c.id],
    rank: 1 + sorted.filter((o) => total[o.id] > total[c.id]).length,
  }));
}

// ---------- Transitions ----------

function openQuestion(s: GameState): void {
  const round = s.rounds[s.roundIndex];
  s.run = {
    roundIndex: s.roundIndex,
    qIndex: s.qIndex,
    questionId: round.questionIds[s.qIndex],
    subjectByCouple:
      round.type === 'partner_prediction'
        ? Object.fromEntries(s.couples.map((c) => [c.id, c.playerIds[(s.roundIndex + s.qIndex) % 2]]))
        : {},
    answers: {},
    revealCursor: 0,
    results: {},
  };
  s.phase = 'question_open';
}

function advanceQuestion(s: GameState): void {
  if (s.run) s.history.push(s.run);
  s.run = null;
  if (s.qIndex + 1 < s.rounds[s.roundIndex].questionIds.length) {
    s.qIndex += 1;
    openQuestion(s);
  } else {
    s.phase = 'round_complete';
  }
}

function advanceRound(s: GameState): void {
  if (s.roundIndex + 1 < s.rounds.length) {
    s.roundIndex += 1;
    s.qIndex = 0;
    s.phase = 'round_intro';
    return;
  }
  const st = standings(s);
  const tied = st.filter((x) => x.rank === 1).length > 1;
  const spare = s.reserve.find((id) => !s.history.some((h) => h.questionId === id));
  if (tied && spare) {
    s.rounds.push({
      type: 'same_answer',
      title: 'Tie-break!',
      blurb: "It's neck and neck. One more Same Answer question — match to pull ahead.",
      scoring: '1 point when your answers match',
      questionIds: [spare],
      tiebreak: true,
    });
    s.roundIndex += 1;
    s.qIndex = 0;
    s.phase = 'round_intro';
    return;
  }
  s.phase = 'game_complete';
}

function checkExpect(s: GameState, expect: Expect): void {
  if (expect.phase !== s.phase || expect.roundIndex !== s.roundIndex || expect.qIndex !== s.qIndex) {
    throw new GameError('stale', 'That action is out of date');
  }
}

/** Players whose answers we wait for before auto-locking: everyone who has joined (all, if nobody has). */
export function requiredPlayerIds(s: GameState): string[] {
  const joined = s.players.filter((p) => p.claimed);
  return (joined.length ? joined : s.players).map((p) => p.id);
}

export function applyHost(state: GameState, action: HostAction): GameState {
  const s = clone(state);
  switch (action.type) {
    case 'rename_couple': {
      const c = s.couples.find((x) => x.id === action.coupleId);
      if (!c) throw new GameError('not_found', 'No such couple');
      c.name = action.name.trim().slice(0, 40) || c.name;
      return s;
    }
    case 'rename_player': {
      const p = s.players.find((x) => x.id === action.playerId);
      if (!p) throw new GameError('not_found', 'No such player');
      p.name = action.name.trim().slice(0, 30) || p.name;
      return s;
    }
    case 'update_settings':
      if (s.phase !== 'lobby') throw new GameError('invalid', 'Settings can only change in the lobby');
      s.settings = { ...s.settings, ...action.settings };
      return s;
    case 'start_round':
      checkExpect(s, action.expect);
      if (s.phase !== 'round_intro') throw new GameError('invalid', 'Not at a round intro');
      openQuestion(s);
      return s;
    case 'lock':
      checkExpect(s, action.expect);
      if (s.phase !== 'question_open') throw new GameError('invalid', 'Nothing to lock');
      lockRun(s);
      return s;
    case 'reveal_next':
      checkExpect(s, action.expect);
      if (s.phase !== 'answers_locked' && s.phase !== 'reveal') throw new GameError('invalid', 'Lock answers before revealing');
      if (s.run!.revealCursor >= s.couples.length) throw new GameError('invalid', 'Everyone is revealed');
      s.run!.revealCursor += 1;
      s.phase = 'reveal';
      return s;
    case 'confirm': {
      checkExpect(s, action.expect);
      const run = s.run;
      const idx = s.couples.findIndex((c) => c.id === action.coupleId);
      if (s.phase !== 'reveal' || !run || idx < 0 || idx >= run.revealCursor) throw new GameError('invalid', 'Reveal that couple first');
      const q = s.questions[run.questionId];
      const cur = run.results[action.coupleId];
      if (q.answerFormat !== 'short_text' || cur.status === 'skipped') throw new GameError('invalid', 'Only text answers need confirming');
      run.results[action.coupleId] = action.match
        ? { status: 'match', points: 1, reason: 'Host says close enough — 1 point' }
        : { status: 'no_match', points: 0, reason: 'Host says no dice' };
      return s;
    }
    case 'skip_question': {
      checkExpect(s, action.expect);
      if (!['question_open', 'answers_locked', 'reveal'].includes(s.phase)) throw new GameError('invalid', 'No question to skip');
      for (const c of s.couples) s.run!.results[c.id] = { status: 'skipped', points: 0, reason: 'Question skipped' };
      advanceQuestion(s);
      return s;
    }
    case 'next':
      checkExpect(s, action.expect);
      if (s.phase === 'reveal') {
        const run = s.run!;
        if (run.revealCursor < s.couples.length) throw new GameError('invalid', 'Reveal every couple first');
        if (Object.values(run.results).some((r) => r.status === 'needs_confirm')) {
          throw new GameError('invalid', 'Decide the "close enough?" answers first');
        }
        advanceQuestion(s);
        return s;
      }
      if (s.phase === 'round_complete') {
        advanceRound(s);
        return s;
      }
      throw new GameError('invalid', 'Nothing to move on to');
    case 'adjust':
      if (s.phase === 'lobby') throw new GameError('invalid', 'Game has not started');
      if (!s.couples.some((c) => c.id === action.coupleId)) throw new GameError('not_found', 'No such couple');
      s.adjustments.push({ coupleId: action.coupleId, delta: Math.max(-5, Math.min(5, Math.trunc(action.delta))) });
      return s;
    case 'pause':
      s.paused = action.paused;
      return s;
    case 'end':
      if (s.phase === 'lobby') throw new GameError('invalid', 'Game has not started');
      s.run = null;
      s.phase = 'game_complete';
      return s;
    case 'reset':
      s.phase = 'lobby';
      s.paused = false;
      s.rounds = [];
      s.reserve = [];
      s.questions = {};
      s.roundIndex = 0;
      s.qIndex = 0;
      s.run = null;
      s.history = [];
      s.adjustments = [];
      s.aiNote = null;
      s.aiPool = [];
      s.aiStatus = 'off';
      return s;
  }
}

export function applyPlayer(state: GameState, playerId: string, action: PlayerAction): GameState {
  if (!state.players.some((p) => p.id === playerId)) throw new GameError('not_found', 'Unknown player');
  if (state.phase !== 'question_open' || !state.run) throw new GameError('locked', 'Answers are locked');
  if (state.paused) throw new GameError('locked', 'Game is paused');
  if (playerId in state.run.answers && !state.settings.allowEdits) throw new GameError('locked', 'Answer already in');
  const q = state.questions[state.run.questionId];
  let value = action.value;
  if (value !== null) {
    value = value.trim().slice(0, 80);
    if (!value) throw new GameError('invalid', 'Empty answer');
    const valid =
      q.answerFormat === 'short_text' ||
      (q.answerFormat === 'who'
        ? state.couples.find((c) => c.playerIds.includes(playerId))!.playerIds.includes(value)
        : q.options.includes(value));
    if (!valid) throw new GameError('invalid', 'Not a valid option');
  }
  const s = clone(state);
  s.run!.answers[playerId] = value;
  if (requiredPlayerIds(s).every((id) => id in s.run!.answers)) lockRun(s);
  return s;
}

export function replaceCurrentQuestion(state: GameState, q: Question): GameState {
  if (state.phase !== 'question_open' || !state.run) throw new GameError('invalid', 'Can only swap an open question');
  if (Object.keys(state.run.answers).length) throw new GameError('invalid', 'Someone already answered — skip instead');
  const cur = state.questions[state.run.questionId];
  if (q.roundType !== cur.roundType) throw new GameError('invalid', 'Replacement is the wrong round type');
  const s = clone(state);
  s.questions[q.id] = q;
  s.rounds[s.roundIndex].questionIds[s.qIndex] = q.id;
  s.run!.questionId = q.id;
  return s;
}

/** An unused question of the current round type — leftover AI questions first, then the bank. */
export function spareQuestion(state: GameState, bank: Question[]): Question | null {
  if (!state.run) return null;
  const type = state.questions[state.run.questionId].roundType;
  const seen = new Set(Object.values(state.questions).map((q) => normaliseText(q.prompt)));
  const pool = state.settings.aiMode ? [...state.aiPool, ...bank] : bank;
  return pool.find((q) => q.roundType === type && !state.questions[q.id] && !seen.has(normaliseText(q.prompt))) ?? null;
}

// ---------- Public view ----------

function awards(s: GameState): Awards {
  const st = standings(s);
  const matches: Record<string, number> = {};
  for (const c of s.couples) matches[c.id] = 0;
  let bestMismatch: Awards['bestMismatch'] = null;
  for (const run of s.history) {
    let miss = 0;
    for (const [cid, r] of Object.entries(run.results)) {
      if (r.status === 'match') matches[cid] += 1;
      if (r.status === 'no_match' || r.status === 'agreed_wrong') miss += 1;
    }
    if (miss > 0 && (!bestMismatch || miss > bestMismatch.mismatches)) {
      bestMismatch = { prompt: s.questions[run.questionId].prompt, mismatches: miss };
    }
  }
  const top = Object.entries(matches).sort((a, b) => b[1] - a[1])[0];
  return {
    winners: st.filter((x) => x.rank === 1).map((x) => x.coupleId),
    mostInSync: top && top[1] > 0 ? { coupleId: top[0], matches: top[1] } : null,
    bestMismatch,
  };
}

export function toPublic(s: GameState): PublicSnapshot {
  const round = s.rounds[s.roundIndex];
  const run = s.run;
  const q = run ? s.questions[run.questionId] : null;
  const revealing = s.phase === 'reveal';
  const { total, byRound } = scoreTotals(s);
  return {
    id: s.id,
    roomCode: s.roomCode,
    phase: s.phase,
    paused: s.paused,
    settings: s.settings,
    couples: s.couples,
    players: s.players.map(({ tokenHash: _t, ...p }) => p),
    round:
      round && s.phase !== 'lobby'
        ? {
            type: round.type,
            title: round.title,
            blurb: round.blurb,
            scoring: round.scoring,
            tiebreak: round.tiebreak,
            index: s.roundIndex,
            total: s.rounds.length,
            questionCount: round.questionIds.length,
          }
        : null,
    qIndex: s.qIndex,
    question: q ? { ...q, correctAnswer: revealing ? q.correctAnswer : null } : null,
    subjectByCouple: run?.subjectByCouple ?? {},
    submitted: run ? Object.keys(run.answers) : [],
    revealCursor: run?.revealCursor ?? 0,
    revealed:
      revealing && run
        ? s.couples.slice(0, run.revealCursor).map((c) => ({
            coupleId: c.id,
            answers: Object.fromEntries(c.playerIds.map((id) => [id, run.answers[id] ?? null])),
            result: run.results[c.id],
          }))
        : [],
    scores: total,
    standings: standings(s),
    roundScores: byRound,
    awards: s.phase === 'game_complete' ? awards(s) : null,
    aiNote: s.aiNote,
    aiStatus: s.aiStatus,
    aiCount: s.aiPool.length,
  };
}
