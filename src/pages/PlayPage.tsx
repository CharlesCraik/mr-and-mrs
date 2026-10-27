import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PlayerView } from '../components/PlayerView';
import { BG, Dots, Toast } from '../components/ui';
import { api, ApiError, RemoteClient } from '../lib/client';
import { useAction, useSnapshot, useToast } from '../lib/hooks';
import { getItem, playerKey, removeItem, setItem, type PlayerSession } from '../lib/session';

export default function PlayPage() {
  const { gameId = '' } = useParams();
  const [session, setSession] = useState<PlayerSession | null>(() => getItem<PlayerSession>(playerKey(gameId)));
  const client = useMemo(() => new RemoteClient(gameId), [gameId]);
  const s = useSnapshot(client);
  const toast = useToast();
  const { run, busy } = useAction(toast.show);

  const claim = useCallback(
    async (playerId: string, playerToken?: string) => {
      const res = await api<{ playerToken: string }>({ op: 'claim', gameId, playerId, playerToken });
      const next = { playerId, playerToken: res.playerToken };
      setItem(playerKey(gameId), next);
      client.setPlayer(playerId, res.playerToken);
      setSession(next);
    },
    [client, gameId],
  );

  // Rejoin with a saved token (restores the session after a refresh or a dead battery).
  useEffect(() => {
    if (!session) return;
    claim(session.playerId, session.playerToken).catch((e) => {
      if (e instanceof ApiError && (e.code === 'taken' || e.code === 'not_found')) {
        removeItem(playerKey(gameId));
        setSession(null);
        toast.show(e.code === 'taken' ? 'That seat was freed by the host — pick again' : 'Game not found');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s) return <main className="flex min-h-[100dvh] items-center justify-center"><Dots /></main>;

  const me = session && s.players.find((p) => p.id === session.playerId);
  if (!session || !me) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 p-4">
        <h1 className="text-4xl font-extrabold">Who are you?</h1>
        {s.couples.map((c) => (
          <div key={c.id} className={`card ${BG[c.colour]} p-3`}>
            <p className="mb-2 font-display text-lg font-extrabold">{c.name}</p>
            <div className="grid grid-cols-2 gap-2">
              {c.playerIds.map((pid) => {
                const p = s.players.find((x) => x.id === pid)!;
                return (
                  <button key={pid} className="btn btn-plain px-2" disabled={p.claimed || busy} onClick={() => run(() => claim(pid))}>
                    {p.claimed ? `${p.name} ✓` : p.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-center text-sm">Taken by mistake? Ask the host to free the slot.</p>
        <Toast msg={toast.msg} />
      </main>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col">
      <PlayerView s={s} playerId={session.playerId} client={client} run={run} busy={busy} />
      <Toast msg={toast.msg} />
    </div>
  );
}
