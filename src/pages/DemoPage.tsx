import { useMemo, useState } from 'react';
import { HostView } from '../components/HostView';
import { PlayerView } from '../components/PlayerView';
import { BG, Toast } from '../components/ui';
import { LocalClient } from '../lib/client';
import { useAction, useSnapshot, useToast } from '../lib/hooks';

/** Single-screen demo: TV view + a phone for any of the 8 players. No backend needed. */
export default function DemoPage() {
  const [seed, setSeed] = useState(0);
  const client = useMemo(() => new LocalClient(), [seed]);
  const s = useSnapshot(client);
  const toast = useToast();
  const { run, busy } = useAction(toast.show);
  const [playerId, setPlayerId] = useState('p1');

  if (!s) return null;

  const autoAnswer = () =>
    run(async () => {
      const q = s.question;
      if (!q || s.phase !== 'question_open') return;
      for (const c of s.couples) {
        for (const pid of c.playerIds) {
          if (s.submitted.includes(pid)) continue;
          const opts = q.answerFormat === 'who' ? c.playerIds : q.options.length ? q.options : ['Beach', 'beach', 'Spa day'];
          await client.answer(pid, opts[Math.floor(Math.random() * opts.length)]);
        }
      }
    });

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1fr_400px]">
      <div className="min-w-0">
        <HostView s={s} client={client} run={run} busy={busy} />
      </div>
      <aside className="border-t-[3px] border-ink bg-white p-4 lg:border-l-[3px] lg:border-t-0">
        <p className="label">Demo: be any player</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {s.players.map((p) => {
            const c = s.couples.find((x) => x.id === p.coupleId)!;
            return (
              <button key={p.id} aria-pressed={p.id === playerId} className={`chip ${p.id === playerId ? BG[c.colour] : 'bg-white'} ${s.submitted.includes(p.id) ? 'line-through' : ''}`} onClick={() => setPlayerId(p.id)}>
                {p.name}
              </button>
            );
          })}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button className="btn btn-plain min-h-[44px] text-sm" disabled={s.phase !== 'question_open'} onClick={autoAnswer}>
            🎲 Random answers for the rest
          </button>
          <button
            className="btn btn-ghost text-sm"
            onClick={() => {
              LocalClient.clear();
              setSeed((x) => x + 1);
            }}
          >
            New demo
          </button>
        </div>
        <div className="mx-auto h-[720px] max-h-[80vh] w-full max-w-[380px] overflow-y-auto rounded-[36px] border-[6px] border-ink bg-cream">
          <PlayerView s={s} playerId={playerId} client={client} run={run} busy={busy} />
        </div>
      </aside>
      <Toast msg={toast.msg} />
    </div>
  );
}
