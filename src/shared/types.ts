export const ROUND_TYPES = ['partner_prediction', 'same_answer', 'true_false_match', 'discussion'] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

// `who` = pick one of the two partners by name; the stored value is the player id.
export const ANSWER_FORMATS = ['multiple_choice', 'yes_no', 'scale_1_5', 'short_text', 'true_false', 'who'] as const;
export type AnswerFormat = (typeof ANSWER_FORMATS)[number];

export const CATEGORIES = [
  'everyday_habits',
  'preferences',
  'hypotheticals',
  'relationship_lore',
  'money_priorities',
  'travel_adventure',
  'would_you_rather',
  'friendly_debates',
  'future_predictions',
  'quick_trivia',
  'spicy_safe',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  everyday_habits: 'Everyday Habits',
  preferences: 'Preferences',
  hypotheticals: 'Hypotheticals',
  relationship_lore: 'Relationship Lore',
  money_priorities: 'Money & Priorities',
  travel_adventure: 'Travel & Adventure',
  would_you_rather: 'Would You Rather?',
  friendly_debates: 'Friendly Debates',
  future_predictions: 'Future Predictions',
  quick_trivia: 'Quick Trivia',
  spicy_safe: 'Spicy but Safe',
};

export type MatchingRule = 'exact' | 'normalised_or_confirm' | 'none';

export interface Question {
  id: string;
  roundType: RoundType;
  category: Category;
  /** Shown to everyone / to the predictor. Uses "your partner". */
  prompt: string;
  /** partner_prediction only: what the subject sees when answering for themselves. */
  promptSelf: string | null;
  answerFormat: AnswerFormat;
  options: string[];
  matchingRule: MatchingRule;
  discussionPrompt: string;
  sensitivity: 'general' | 'spicy';
  statementType: 'objective' | 'subjective' | null;
  correctAnswer: 'True' | 'False' | null;
  source?: 'bank' | 'ai';
}

export type Tone = 'silly' | 'debate' | 'gentle';
export type GameLength = 'standard' | 'quick';

export interface Settings {
  length: GameLength;
  aiMode: boolean;
  tone: Tone;
  categories: Category[];
  spicy: boolean;
  allowEdits: boolean;
}

export const COUPLE_COLOURS = ['tomato', 'sunflower', 'teal', 'grape'] as const;
export type CoupleColour = (typeof COUPLE_COLOURS)[number];

export interface Player {
  id: string;
  name: string;
  coupleId: string;
  claimed: boolean;
  tokenHash?: string | null;
}

export interface Couple {
  id: string;
  name: string;
  colour: CoupleColour;
  playerIds: [string, string];
}

export interface RoundPlan {
  type: RoundType;
  title: string;
  blurb: string;
  scoring: string;
  questionIds: string[];
  tiebreak?: boolean;
}

export type Phase =
  | 'lobby'
  | 'round_intro'
  | 'question_open'
  | 'answers_locked'
  | 'reveal'
  | 'round_complete'
  | 'game_complete';

export type ResultStatus = 'match' | 'no_match' | 'agreed_wrong' | 'needs_confirm' | 'skipped' | 'no_score';

export interface CoupleResult {
  status: ResultStatus;
  points: number;
  reason: string;
}

export interface QuestionRun {
  roundIndex: number;
  qIndex: number;
  questionId: string;
  /** partner_prediction: which player answers for themselves. */
  subjectByCouple: Record<string, string>;
  /** value null = player skipped. */
  answers: Record<string, string | null>;
  revealCursor: number;
  results: Record<string, CoupleResult>;
}

export interface Adjustment {
  coupleId: string;
  delta: number;
}

export interface GameState {
  id: string;
  roomCode: string;
  phase: Phase;
  paused: boolean;
  settings: Settings;
  couples: Couple[];
  players: Player[];
  questions: Record<string, Question>;
  rounds: RoundPlan[];
  /** Spare same_answer questions for tie-breaks / regenerate. */
  reserve: string[];
  roundIndex: number;
  qIndex: number;
  run: QuestionRun | null;
  history: QuestionRun[];
  adjustments: Adjustment[];
  aiNote: string | null;
  aiStatus: AiStatus;
  /** Validated AI questions waiting to be used (private — never in snapshots). */
  aiPool: Question[];
  generations: number;
}

export type AiStatus = 'off' | 'writing' | 'ready' | 'failed';

// ---------- Actions ----------

export interface Expect {
  phase: Phase;
  roundIndex: number;
  qIndex: number;
}

export type HostAction =
  | { type: 'rename_couple'; coupleId: string; name: string }
  | { type: 'rename_player'; playerId: string; name: string }
  | { type: 'update_settings'; settings: Partial<Settings> }
  | { type: 'start_round'; expect: Expect }
  | { type: 'lock'; expect: Expect }
  | { type: 'reveal_next'; expect: Expect }
  | { type: 'confirm'; expect: Expect; coupleId: string; match: boolean }
  | { type: 'skip_question'; expect: Expect }
  | { type: 'next'; expect: Expect }
  | { type: 'adjust'; coupleId: string; delta: number }
  | { type: 'pause'; paused: boolean }
  | { type: 'end' }
  | { type: 'reset' };

export type PlayerAction = { type: 'answer'; value: string | null };

// ---------- Public snapshot (safe for every client) ----------

export type PublicQuestion = Omit<Question, 'correctAnswer'> & { correctAnswer: 'True' | 'False' | null };

export interface RevealedCouple {
  coupleId: string;
  answers: Record<string, string | null>;
  result: CoupleResult;
}

export interface Standing {
  coupleId: string;
  score: number;
  rank: number;
}

export interface Awards {
  winners: string[];
  mostInSync: { coupleId: string; matches: number } | null;
  bestMismatch: { prompt: string; mismatches: number } | null;
}

export interface PublicSnapshot {
  /** Monotonic revision so clients can drop out-of-order updates. */
  rev?: number;
  id: string;
  roomCode: string;
  phase: Phase;
  paused: boolean;
  settings: Settings;
  couples: Couple[];
  players: Omit<Player, 'tokenHash'>[];
  round: (Omit<RoundPlan, 'questionIds'> & { index: number; total: number; questionCount: number }) | null;
  qIndex: number;
  question: PublicQuestion | null;
  subjectByCouple: Record<string, string>;
  submitted: string[];
  revealCursor: number;
  revealed: RevealedCouple[];
  scores: Record<string, number>;
  standings: Standing[];
  roundScores: Record<string, number[]>;
  awards: Awards | null;
  aiNote: string | null;
  aiStatus: AiStatus;
  aiCount: number;
}
