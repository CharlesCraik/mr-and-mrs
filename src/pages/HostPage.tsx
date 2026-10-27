import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HostView } from '../components/HostView';
import { Dots, Toast } from '../components/ui';
import { RemoteClient } from '../lib/client';
import { useAction, useSnapshot, useToast } from '../lib/hooks';
import { getItem, hostKey } from '../lib/session';

export default function HostPage() {
  const { gameId = '' } = useParams();
  const hostToken = getItem<string>(hostKey(gameId));
  const client = useMemo(() => (hostToken ? new RemoteClient(gameId, { hostToken }) : null), [gameId, hostToken]);
  const s = useSnapshot(client);
  const toast = useToast();
  const { run, busy } = useAction(toast.show);

  if (!hostToken) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-3xl font-extrabold">This device isn’t the host</h1>
        <p>Host controls live on the device that created the game.</p>
        <Link className="btn btn-go" to="/join">Join as a player</Link>
      </main>
    );
  }
  if (!s) return <main className="flex min-h-[100dvh] items-center justify-center"><Dots /></main>;
  return (
    <>
      <HostView s={s} client={client!} run={run} busy={busy} joinUrl={`${location.origin}/join/${s.roomCode}`} />
      <Toast msg={toast.msg} />
    </>
  );
}
