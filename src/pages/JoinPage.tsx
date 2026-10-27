import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Logo, Toast } from '../components/ui';
import { api } from '../lib/client';
import { useToast } from '../lib/hooks';

export default function JoinPage() {
  const params = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [busy, setBusy] = useState(false);

  const go = async (c: string) => {
    setBusy(true);
    try {
      const { gameId } = await api<{ gameId: string }>({ op: 'lookup', roomCode: c });
      nav(`/play/${gameId}`, { replace: true });
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not find that game');
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.code?.length === 4) void go(params.code.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center gap-6 p-4">
      <Logo />
      <h1 className="text-4xl font-extrabold">Join the party</h1>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 4) void go(code);
        }}
      >
        <input
          className="input text-center font-display text-5xl tracking-[0.3em] uppercase"
          maxLength={4}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          placeholder="CODE"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          aria-label="Room code"
        />
        <button className="btn btn-go text-2xl" disabled={busy || code.length !== 4}>
          {busy ? 'Finding…' : 'Join →'}
        </button>
      </form>
      <Toast msg={toast.msg} />
    </main>
  );
}
