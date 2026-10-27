import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { GameClient } from '../lib/client';
import { expectOf } from '../lib/hooks';
import { CATEGORIES, CATEGORY_LABELS, type Couple, type PublicSnapshot, type Settings } from '../shared/types';
import { answerLabel, BG, Confetti, Confirm, Dots, Logo, Modal, nameOf, ResultBadge, ScoreStrip } from './ui';

interface Props {
  s: PublicSnapshot;
  client: GameClient;
  run: (fn: () => Promise<void>) => void;
  busy: boolean;
  joinUrl?: string;
}

export function HostView(props: Props) {
  const { s } = props;
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      {s.phase !== 'lobby' && <HostHeader {...props} />}
      {s.paused && <div className="card-flat bg-sunflower p-3 text-center font-display text-2xl font-extrabold">⏸ Paused — top up your drinks</div>}
      {s.phase === 'lobby' && <Lobby {...props} />}
      {s.phase === 'round_intro' && <RoundIntro {...props} />}
      {(s.phase === 'question_open' || s.phase === 'answers_locked' || s.phase === 'reveal') && <QuestionStage {...props} />}
      {s.phase === 'round_complete' && <Leaderboard {...props} />}
      {s.phase === 'game_complete' && <Results {...props} />}
    </div>
  );
}

function HostHeader({ s, client, run }: Props) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<'end' | 'reset' | null>(null);
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <Logo />
        {s.round && s.phase !== 'game_complete' && (
          <span className="chip bg-white">
            Round {s.round.index + 1}/{s.round.total}
            {['question_open', 'answers_locked', 'reveal'].includes(s.phase) && ` · Q${s.qIndex + 1}/${s.round.questionCount}`}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ScoreStrip s={s} />
        <button className="btn btn-plain min-h-[44px] px-4 text-base" onClick={() => setMenu(true)} aria-label="Host menu">
          ☰
        </button>
      </div>
      {menu && (
        <Modal onClose={() => setMenu(false)}>
          <h2 className="text-3xl font-extrabold">Host menu</h2>
          <div className="mt-4 grid gap-3">
            <button className="btn btn-primary" onClick={() => { run(() => client.host({ type: 'pause', paused: !s.paused })); setMenu(false); }}>
              {s.paused ? '▶ Resume' : '⏸ Pause game'}
            </button>
            <AdjustScores s={s} client={client} run={run} />
            {s.phase !== 'game_complete' && (
              <button className="btn btn-plain" onClick={() => { setMenu(false); setConfirm('end'); }}>
                🏁 End game now
              </button>
            )}
            <button className="btn btn-hot" onClick={() => { setMenu(false); setConfirm('reset'); }}>
              ↺ Reset to lobby
            </button>
          </div>
        </Modal>
      )}
      {confirm === 'end' && (
        <Confirm title="End the game?" body="Jump straight to the final results with the current scores." yes="End it" onYes={() => run(() => client.host({ type: 'end' }))} onClose={() => setConfirm(null)} />
      )}
      {confirm === 'reset' && (
        <Confirm title="Reset the game?" body="All scores are wiped and everyone goes back to the lobby. Players stay joined." yes="Reset" onYes={() => run(() => client.host({ type: 'reset' }))} onClose={() => setConfirm(null)} />
      )}
    </header>
  );
}

function AdjustScores({ s, client, run }: Pick<Props, 's' | 'client' | 'run'>) {
  return (
    <div className="card-flat bg-white p-3">
      <p className="label">Fix a score</p>
      <div className="grid gap-2">
        {s.couples.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <span className={`chip ${BG[c.colour]} flex-1 truncate`}>{c.name}</span>
            <button className="btn btn-plain min-h-[44px] px-4" aria-label={`Minus one point for ${c.name}`} onClick={() => run(() => client.host({ type: 'adjust', coupleId: c.id, delta: -1 }))}>
              −
            </button>
            <span className="w-8 text-center font-display text-xl font-extrabold">{s.scores[c.id]}</span>
            <button className="btn btn-plain min-h-[44px] px-4" aria-label={`Plus one point for ${c.name}`} onClick={() => run(() => client.host({ type: 'adjust', coupleId: c.id, delta: 1 }))}>
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Lobby ----------

const TONES: { id: Settings['tone']; label: string }[] = [
  { id: 'silly', label: '🤪 More silly' },
  { id: 'debate', label: '🔥 Debate-worthy' },
  { id: 'gentle', label: '🌿 Less personal' },
];

function Lobby({ s, client, run, busy, joinUrl }: Props) {
  const [confirmStart, setConfirmStart] = useState(false);
  const set = (settings: Partial<Settings>) => run(() => client.host({ type: 'update_settings', settings }));
  const missing = s.players.filter((p) => !p.claimed).length;
  const remote = client.mode === 'remote';
  const toggleCat = (c: (typeof CATEGORIES)[number]) => {
    const has = s.settings.categories.includes(c);
    const next = has ? s.settings.categories.filter((x) => x !== c) : [...s.settings.categories, c];
    if (next.length) set({ categories: next, ...(c === 'spicy_safe' ? { spicy: !has } : {}) });
  };
  const toggleAi = () => {
    const on = !s.settings.aiMode;
    run(async () => {
      await client.host({ type: 'update_settings', settings: { aiMode: on } });
      if (on && (s.aiStatus === 'off' || s.aiStatus === 'failed')) await client.generateAi();
    });
  };
  const start = () => run(() => client.start());

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="flex flex-col gap-6">
        <Logo size="lg" />
        {remote && (
          <div className="card flex flex-col items-center gap-6 bg-sunflower p-6 sm:flex-row">
            <div className="rounded-2xl border-[3px] border-ink bg-white p-3">
              <QRCodeSVG value={joinUrl ?? ''} size={168} />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xl font-bold">Scan, or go to {location.host}/join and enter</p>
              <p className="font-display text-7xl font-extrabold tracking-[0.2em] sm:text-8xl">{s.roomCode}</p>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {s.couples.map((c) => (
            <CoupleSlot key={c.id} s={s} c={c} client={client} run={run} />
          ))}
        </div>
      </section>

      <aside className="card flex flex-col gap-5 bg-white p-5">
        <h2 className="text-3xl font-extrabold">Game settings</h2>
        <div>
          <p className="label">Length</p>
          <div className="grid grid-cols-2 gap-2">
            {(['standard', 'quick'] as const).map((l) => (
              <button key={l} aria-pressed={s.settings.length === l} className={`btn ${s.settings.length === l ? 'btn-primary' : 'btn-plain'} px-2 text-base`} onClick={() => set({ length: l })}>
                {l === 'standard' ? 'Standard ~40m' : 'Quick ~20m'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="label">Questions</p>
          <button aria-pressed={s.settings.aiMode} disabled={!remote} className={`btn w-full ${s.settings.aiMode ? 'btn-go' : 'btn-plain'} text-base`} onClick={toggleAi}>
            {s.settings.aiMode ? '✨ AI mode ON' : '📦 House questions'}
          </button>
          <p className="mt-2 text-sm">
            {!remote
              ? 'AI mode needs the online version.'
              : !s.settings.aiMode
                ? '25 hand-picked questions. Flip on AI for a fresh batch every game.'
                : s.aiStatus === 'writing'
                  ? <span className="inline-flex items-center gap-2">AI is writing your questions <Dots /></span>
                  : s.aiStatus === 'ready'
                    ? `✓ ${s.aiCount} fresh questions ready`
                    : s.aiStatus === 'failed'
                      ? 'AI unavailable — house questions will be used.'
                      : 'Starting up…'}
          </p>
          {remote && s.settings.aiMode && s.aiStatus !== 'writing' && (
            <button className="btn btn-ghost" onClick={() => run(() => client.generateAi())}>
              Write a new batch
            </button>
          )}
        </div>

        {s.settings.aiMode && (
          <>
            <div>
              <p className="label">Tone</p>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button key={t.id} aria-pressed={s.settings.tone === t.id} className={`chip ${s.settings.tone === t.id ? 'bg-sunflower' : 'bg-white'}`} onClick={() => set({ tone: t.id })}>
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs">Change tone, then “Write a new batch”.</p>
            </div>
            <div>
              <p className="label">Categories</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const on = s.settings.categories.includes(c);
                  return (
                    <button key={c} aria-pressed={on} className={`chip ${on ? (c === 'spicy_safe' ? 'bg-tomato' : 'bg-teal') : 'bg-white opacity-70'}`} onClick={() => toggleCat(c)}>
                      {on ? '✓' : '+'} {CATEGORY_LABELS[c]}
                      {c === 'spicy_safe' && ' 🌶'}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="mt-auto">
          <button className="btn btn-hot w-full text-2xl" disabled={busy || s.aiStatus === 'writing'} onClick={() => (missing && remote ? setConfirmStart(true) : start())}>
            Let’s play! →
          </button>
          {remote && <p className="mt-2 text-center text-sm font-semibold">{missing ? `Waiting for ${missing} player${missing > 1 ? 's' : ''}` : 'Everyone’s in 🎉'}</p>}
        </div>
      </aside>

      {confirmStart && (
        <Confirm
          title="Start without everyone?"
          body={`${missing} player${missing > 1 ? 's haven’t' : ' hasn’t'} joined. Their answers will count as skipped (they can still join mid-game).`}
          yes="Start anyway"
          onYes={start}
          onClose={() => setConfirmStart(false)}
        />
      )}
    </div>
  );
}

function CoupleSlot({ s, c, client, run }: { s: PublicSnapshot; c: Couple; client: GameClient; run: Props['run'] }) {
  return (
    <div className={`card ${BG[c.colour]} p-4`}>
      <input
        className="w-full bg-transparent font-display text-2xl font-extrabold outline-none"
        defaultValue={c.name}
        aria-label="Couple name"
        onBlur={(e) => e.target.value !== c.name && run(() => client.host({ type: 'rename_couple', coupleId: c.id, name: e.target.value }))}
      />
      <div className="mt-3 grid gap-2">
        {c.playerIds.map((pid) => {
          const p = s.players.find((x) => x.id === pid)!;
          return (
            <div key={pid} className="flex items-center gap-2 rounded-xl border-[3px] border-ink bg-white px-3 py-2">
              <span aria-hidden className="text-lg">{p.claimed ? '✅' : '⏳'}</span>
              <span className="flex-1 font-bold">{p.name}</span>
              <span className="text-sm">{p.claimed ? 'joined' : 'not joined'}</span>
              {p.claimed && client.mode === 'remote' && (
                <button className="text-sm underline" onClick={() => run(() => client.release(pid))} aria-label={`Free up ${p.name}'s slot`}>
                  free slot
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Round intro ----------

const ROUND_BG = ['bg-tomato', 'bg-sunflower', 'bg-teal', 'bg-grape', 'bg-mint'];

function RoundIntro({ s, client, run, busy }: Props) {
  const r = s.round!;
  return (
    <section className={`card flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center ${ROUND_BG[r.index % ROUND_BG.length]} anim-pop`}>
      {s.aiNote && r.index === 0 && <span className="chip bg-white">✨ {s.aiNote}</span>}
      <p className="font-display text-2xl font-extrabold uppercase">{r.tiebreak ? 'Sudden death' : `Round ${r.index + 1}`}</p>
      <h1 className="max-w-4xl text-5xl font-extrabold leading-none sm:text-7xl">{r.title}</h1>
      <p className="max-w-2xl text-xl font-semibold sm:text-2xl">{r.blurb}</p>
      <span className="chip bg-white text-lg">🏆 {r.scoring}</span>
      <button className="btn btn-plain mt-2 text-2xl" disabled={busy} onClick={() => run(() => client.host({ type: 'start_round', expect: expectOf(s) }))}>
        Start round →
      </button>
    </section>
  );
}

// ---------- Question / reveal ----------

function QuestionStage({ s, client, run, busy }: Props) {
  const q = s.question!;
  const open = s.phase === 'question_open';
  const allRevealed = s.revealCursor >= s.couples.length;
  const pendingConfirm = s.revealed.some((r) => r.result.status === 'needs_confirm');
  const e = expectOf(s);
  const isPrediction = q.roundType === 'partner_prediction';

  return (
    <section className="flex flex-1 flex-col gap-5">
      <div className="card bg-white p-6 sm:p-8">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="chip bg-sunflower">{CATEGORY_LABELS[q.category]}</span>
          {q.roundType === 'true_false_match' && (
            <span className="chip bg-white">{q.statementType === 'objective' ? '📚 Fact — there’s a right answer' : '💬 Opinion — just agree!'}</span>
          )}
        </div>
        <h1 className="q-text font-extrabold">{q.prompt}</h1>
        {q.answerFormat === 'multiple_choice' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {q.options.map((o) => (
              <span key={o} className="chip bg-cream text-lg">{o}</span>
            ))}
          </div>
        )}
        {s.phase === 'reveal' && q.correctAnswer && (
          <p className="mt-4 inline-block rounded-xl border-[3px] border-ink bg-mint px-4 py-2 text-xl font-bold anim-pop">
            The answer: {q.correctAnswer === 'True' ? 'TRUE ✓' : 'FALSE ✗'}
          </p>
        )}
      </div>

      <div className="grid flex-1 gap-4 sm:grid-cols-2">
        {s.couples.map((c, i) => (
          <CoupleStageCard key={c.id} s={s} c={c} revealIdx={i} isPrediction={isPrediction} client={client} run={run} />
        ))}
      </div>

      {s.phase === 'reveal' && allRevealed && (
        <div className="card bg-grape p-5 anim-pop">
          <p className="label">Talk about it</p>
          <p className="font-display text-2xl font-extrabold sm:text-3xl">💬 {q.discussionPrompt}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {open && (
          <>
            <button className="btn btn-ghost" disabled={busy || s.submitted.length > 0} onClick={() => run(() => client.regenerate())} title="Only before anyone answers">
              🔄 Swap question
            </button>
            <button className="btn btn-plain" disabled={busy} onClick={() => run(() => client.host({ type: 'skip_question', expect: e }))}>
              Skip question
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => client.host({ type: 'lock', expect: e }))}>
              🔒 Lock answers ({s.submitted.length}/{s.players.length})
            </button>
          </>
        )}
        {!open && !allRevealed && (
          <button className="btn btn-hot text-2xl" disabled={busy} onClick={() => run(() => client.host({ type: 'reveal_next', expect: e }))}>
            Reveal {s.couples[s.revealCursor].name} →
          </button>
        )}
        {s.phase === 'reveal' && allRevealed && (
          <button className="btn btn-go text-2xl" disabled={busy || pendingConfirm} onClick={() => run(() => client.host({ type: 'next', expect: e }))}>
            {pendingConfirm ? 'Decide the “close enough?” first' : 'Next →'}
          </button>
        )}
      </div>
    </section>
  );
}

function CoupleStageCard({ s, c, revealIdx, isPrediction, client, run }: { s: PublicSnapshot; c: Couple; revealIdx: number; isPrediction: boolean; client: GameClient; run: Props['run'] }) {
  const revealed = s.revealed.find((r) => r.coupleId === c.id);
  const subject = s.subjectByCouple[c.id];
  const isNext = !revealed && s.phase !== 'question_open' && revealIdx === s.revealCursor;

  if (revealed) {
    const order = isPrediction ? [c.playerIds.find((p) => p !== subject)!, subject] : c.playerIds;
    return (
      <div className={`card relative ${BG[c.colour]} p-4 anim-flip`}>
        {revealed.result.status === 'match' && <Confetti />}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-2xl font-extrabold">{c.name}</h3>
          <ResultBadge result={revealed.result} big />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {order.map((pid) => (
            <div key={pid} className="rounded-xl border-[3px] border-ink bg-white p-3">
              <p className="text-sm font-bold uppercase">
                {nameOf(s, pid)}
                {isPrediction && (pid === subject ? ' said' : ' guessed')}
              </p>
              <p className="font-display text-2xl font-extrabold leading-tight break-words">{answerLabel(s, revealed.answers[pid])}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 font-semibold">{revealed.result.reason}</p>
        {revealed.result.status === 'needs_confirm' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn btn-go" onClick={() => run(() => client.host({ type: 'confirm', expect: expectOf(s), coupleId: c.id, match: true }))}>
              ✓ Count it
            </button>
            <button className="btn btn-plain" onClick={() => run(() => client.host({ type: 'confirm', expect: expectOf(s), coupleId: c.id, match: false }))}>
              ✗ Nope
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`card ${BG[c.colour]} p-4 ${isNext ? 'anim-wobble' : ''}`}>
      <h3 className="text-2xl font-extrabold">{c.name}</h3>
      {isPrediction && s.phase === 'question_open' && (
        <p className="text-sm font-semibold">
          {nameOf(s, subject)} answers · {nameOf(s, c.playerIds.find((p) => p !== subject)!)} guesses
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {c.playerIds.map((pid) => {
          const done = s.submitted.includes(pid);
          return (
            <span key={pid} className={`chip ${done ? 'bg-ink text-cream' : 'border-dashed bg-white'}`}>
              {done ? '✓' : <Dots />} {nameOf(s, pid)}
            </span>
          );
        })}
      </div>
      {s.phase !== 'question_open' && <p className="mt-3 font-display text-xl font-extrabold">{isNext ? '👀 Up next…' : '🂠 Face down'}</p>}
    </div>
  );
}

// ---------- Leaderboard / results ----------

function Leaderboard({ s, client, run, busy }: Props) {
  const last = s.round!.index + 1 >= s.round!.total;
  return (
    <section className="card flex flex-1 flex-col gap-6 bg-white p-6 sm:p-10">
      <h1 className="text-5xl font-extrabold">End of round {s.round!.index + 1}!</h1>
      <Standings s={s} />
      <button className="btn btn-go self-end text-2xl" disabled={busy} onClick={() => run(() => client.host({ type: 'next', expect: expectOf(s) }))}>
        {last ? 'Final results →' : 'Next round →'}
      </button>
    </section>
  );
}

function Standings({ s }: { s: PublicSnapshot }) {
  const max = Math.max(1, ...Object.values(s.scores));
  return (
    <ol className="grid gap-3">
      {s.standings.map((st) => {
        const c = s.couples.find((x) => x.id === st.coupleId)!;
        return (
          <li key={c.id} className="flex items-center gap-3">
            <span className="w-10 text-center font-display text-3xl font-extrabold">{st.rank}</span>
            <div className="relative h-16 flex-1 overflow-hidden rounded-2xl border-[3px] border-ink bg-cream">
              <div className={`absolute inset-y-0 left-0 ${BG[c.colour]} border-r-[3px] border-ink transition-[width] duration-700`} style={{ width: `${Math.max(8, (st.score / max) * 100)}%` }} />
              <span className="relative flex h-full items-center px-4 font-display text-2xl font-extrabold">{c.name}</span>
            </div>
            <span className="w-14 text-right font-display text-4xl font-extrabold">{st.score}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Results({ s, client, run }: Props) {
  const [confirm, setConfirm] = useState(false);
  const a = s.awards!;
  const winners = a.winners.map((id) => s.couples.find((c) => c.id === id)!);
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className={`card relative overflow-hidden p-8 text-center ${winners.length === 1 ? BG[winners[0].colour] : 'bg-sunflower'} anim-pop`}>
        <Confetti />
        <p className="font-display text-2xl font-extrabold uppercase">{winners.length > 1 ? 'It’s a draw!' : 'The winners'}</p>
        <h1 className="mt-2 text-6xl font-extrabold sm:text-8xl">🏆 {winners.map((w) => w.name).join(' & ')}</h1>
        <p className="mt-3 text-xl font-semibold">Remember: this proves absolutely nothing about anyone’s relationship. 😉</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="card bg-white p-6">
          <Standings s={s} />
        </div>
        <div className="grid gap-4">
          {a.mostInSync && (
            <div className="card bg-teal p-5">
              <p className="label">🧠 Most in sync</p>
              <p className="font-display text-2xl font-extrabold">{s.couples.find((c) => c.id === a.mostInSync!.coupleId)!.name}</p>
              <p>{a.mostInSync.matches} matching answers</p>
            </div>
          )}
          {a.bestMismatch && (
            <div className="card bg-tomato p-5">
              <p className="label">😬 Most divisive question</p>
              <p className="font-display text-xl font-extrabold">“{a.bestMismatch.prompt}”</p>
              <p>{a.bestMismatch.mismatches} couple{a.bestMismatch.mismatches > 1 ? 's' : ''} didn’t match</p>
            </div>
          )}
        </div>
      </div>
      <button className="btn btn-primary self-center text-2xl" onClick={() => setConfirm(true)}>
        Play again ↺
      </button>
      {confirm && (
        <Confirm
          title="Play again?"
          body={s.settings.aiMode ? 'Back to the lobby — AI will write a fresh batch.' : 'Back to the lobby with the same couples. Tip: turn on AI mode for brand-new questions.'}
          yes="Let’s go"
          onYes={() =>
            run(async () => {
              await client.host({ type: 'reset' });
              if (s.settings.aiMode && client.mode === 'remote') await client.generateAi();
            })
          }
          onClose={() => setConfirm(false)}
        />
      )}
    </section>
  );
}
