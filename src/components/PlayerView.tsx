import { useEffect, useState } from 'react';
import type { GameClient } from '../lib/client';
import { getItem, setItem } from '../lib/session';
import type { PublicSnapshot } from '../shared/types';
import { answerLabel, BG, coupleOf, Dots, nameOf, ResultBadge } from './ui';

interface Props {
  s: PublicSnapshot;
  playerId: string;
  client: GameClient;
  run: (fn: () => Promise<void>) => void;
  busy: boolean;
}

/** Swap "your partner" for the partner's actual name so the guesser knows who they're guessing. */
function personalise(prompt: string, partner: string) {
  return prompt.replace(/\byour partner\b/gi, partner);
}

export function PlayerView({ s, playerId, client, run, busy }: Props) {
  const me = s.players.find((p) => p.id === playerId)!;
  const couple = coupleOf(s, playerId)!;
  const partnerId = couple.playerIds.find((p) => p !== playerId)!;
  const myScore = s.scores[couple.id];
  const rank = s.standings.find((x) => x.coupleId === couple.id)?.rank;

  return (
    <div className="flex min-h-full flex-col">
      <header className={`${BG[couple.colour]} flex items-center justify-between border-b-[3px] border-ink px-4 py-3`}>
        <div>
          <p className="text-xs font-bold uppercase">{couple.name}</p>
          <p className="font-display text-xl font-extrabold">{me.name}</p>
        </div>
        {s.phase !== 'lobby' && (
          <span className="chip bg-white text-base">
            {myScore} pts{rank ? ` · #${rank}` : ''}
          </span>
        )}
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4">
        {s.paused ? (
          <Centered emoji="⏸" title="Paused" body="Perfect time for a refill." />
        ) : s.phase === 'lobby' ? (
          <Centered emoji="🎉" title="You’re in!" body={`Partnered with ${nameOf(s, partnerId)}. Waiting for the host to start…`} dots />
        ) : s.phase === 'round_intro' ? (
          <Centered emoji="📺" title={s.round!.title} body={s.round!.blurb} />
        ) : s.phase === 'question_open' ? (
          <Answering s={s} playerId={playerId} partnerId={partnerId} client={client} run={run} busy={busy} />
        ) : s.phase === 'answers_locked' ? (
          <Centered emoji="🔒" title="Answers locked" body="Eyes on the TV for the big reveal…" dots />
        ) : s.phase === 'reveal' ? (
          <MyReveal s={s} coupleId={couple.id} />
        ) : s.phase === 'round_complete' ? (
          <Centered emoji="📊" title={`You’re #${rank} with ${myScore}`} body="Check the TV for the leaderboard." />
        ) : (
          <Centered
            emoji={s.awards?.winners.includes(couple.id) ? '🏆' : '🥂'}
            title={s.awards?.winners.includes(couple.id) ? 'You won!' : `You finished #${rank}`}
            body="Thanks for playing — now argue about it over another drink."
          />
        )}
      </main>
    </div>
  );
}

function Centered({ emoji, title, body, dots }: { emoji: string; title: string; body: string; dots?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center anim-pop">
      <span className="text-6xl" aria-hidden>
        {emoji}
      </span>
      <h2 className="text-3xl font-extrabold">{title}</h2>
      <p className="max-w-xs text-lg">{body}</p>
      {dots && <Dots />}
    </div>
  );
}

function MyReveal({ s, coupleId }: { s: PublicSnapshot; coupleId: string }) {
  const mine = s.revealed.find((r) => r.coupleId === coupleId);
  if (!mine) return <Centered emoji="🥁" title="Reveal time!" body="Watch the TV — your turn’s coming." dots />;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center anim-pop">
      <ResultBadge result={mine.result} big />
      <div className="grid w-full gap-2">
        {Object.entries(mine.answers).map(([pid, v]) => (
          <div key={pid} className="card-flat bg-white p-3">
            <p className="text-sm font-bold uppercase">{nameOf(s, pid)}</p>
            <p className="font-display text-2xl font-extrabold">{answerLabel(s, v)}</p>
          </div>
        ))}
      </div>
      <p className="font-semibold">{mine.result.reason}</p>
    </div>
  );
}

function Answering({ s, playerId, partnerId, client, run, busy }: Props & { partnerId: string }) {
  const q = s.question!;
  const key = `mm:ans:${s.id}:${playerId}:${q.id}`;
  const [mine, setMine] = useState<string | null | undefined>(() => getItem<{ v: string | null }>(key)?.v);
  const [text, setText] = useState('');
  useEffect(() => {
    setMine(getItem<{ v: string | null }>(key)?.v);
    setText('');
  }, [key]);

  const submitted = s.submitted.includes(playerId);
  const isSubject = q.roundType === 'partner_prediction' && s.subjectByCouple[coupleIdOf(s, playerId)] === playerId;
  const isGuesser = q.roundType === 'partner_prediction' && !isSubject;
  const partner = nameOf(s, partnerId);
  const prompt = isSubject ? q.promptSelf ?? q.prompt : isGuesser ? personalise(q.prompt, partner) : q.prompt;

  const send = (v: string | null) =>
    run(async () => {
      await client.answer(playerId, v);
      setItem(key, { v });
      setMine(v);
    });

  const choices: { value: string; label: string }[] =
    q.answerFormat === 'who'
      ? [playerId, partnerId].map((id) => ({ value: id, label: id === playerId ? `Me (${nameOf(s, id)})` : nameOf(s, id) }))
      : q.options.map((o) => ({ value: o, label: q.answerFormat === 'scale_1_5' ? o : o }));

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {isSubject && <span className="chip bg-sunflower">🙋 About YOU — answer honestly</span>}
        {isGuesser && <span className="chip bg-teal">🔮 Guess what {partner} says</span>}
        {q.roundType === 'same_answer' && <span className="chip bg-sunflower">🤝 Match {partner}</span>}
        {q.roundType === 'true_false_match' && <span className="chip bg-sunflower">🤝 Agree with {partner}</span>}
        {q.roundType === 'discussion' && <span className="chip bg-grape">💬 No points — pick a side</span>}
      </div>
      <h2 className="text-3xl font-extrabold leading-tight">{prompt}</h2>

      {q.answerFormat === 'short_text' ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send(text.trim());
          }}
        >
          <input className="input" maxLength={80} value={text} onChange={(e) => setText(e.target.value)} placeholder={mine ? `Sent: ${mine}` : 'Type your answer'} aria-label="Your answer" />
          <button className="btn btn-primary" disabled={busy || !text.trim()}>
            {submitted ? 'Change answer' : 'Lock it in'}
          </button>
        </form>
      ) : (
        <div className={`grid gap-3 ${q.answerFormat === 'scale_1_5' ? 'grid-cols-5' : q.options.length === 2 || q.answerFormat === 'who' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {choices.map((c) => {
            const picked = submitted && mine === c.value;
            return (
              <button
                key={c.value}
                aria-pressed={picked}
                disabled={busy || (submitted && !s.settings.allowEdits)}
                className={`btn ${picked ? 'btn-go' : 'btn-plain'} ${q.answerFormat === 'scale_1_5' ? 'px-0 text-2xl' : 'text-xl'} min-h-[64px] break-words`}
                onClick={() => send(c.value)}
              >
                {picked && <span aria-hidden>✓</span>} {c.label}
              </button>
            );
          })}
        </div>
      )}
      {q.answerFormat === 'scale_1_5' && (
        <div className="-mt-2 flex justify-between text-sm font-semibold">
          <span>1 = disaster</span>
          <span>5 = dream team</span>
        </div>
      )}

      <div className="mt-auto flex flex-col items-center gap-1 text-center">
        {submitted ? (
          <p className="font-bold">
            {mine === null ? 'Skipped — no penalty.' : '✓ Locked in.'} {s.settings.allowEdits && 'You can change it until everyone’s done.'}
          </p>
        ) : (
          <button className="btn btn-ghost" disabled={busy} onClick={() => send(null)}>
            Skip this one (no penalty)
          </button>
        )}
        <p className="text-sm">
          {s.submitted.length}/{s.players.length} answered
        </p>
      </div>
    </div>
  );
}

function coupleIdOf(s: PublicSnapshot, playerId: string) {
  return coupleOf(s, playerId)!.id;
}
