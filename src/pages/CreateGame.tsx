import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BG, Logo, Toast } from '../components/ui';
import { createRemoteGame, RemoteClient } from '../lib/client';
import { useToast } from '../lib/hooks';
import { hostKey, setItem } from '../lib/session';
import { COUPLE_COLOURS } from '../shared/types';

const empty = () => COUPLE_COLOURS.map(() => ({ name: '', players: ['', ''] as [string, string] }));

export default function CreateGame() {
  const nav = useNavigate();
  const toast = useToast();
  const [couples, setCouples] = useState(empty);
  const [aiMode, setAiMode] = useState(false);
  const [length, setLength] = useState<'standard' | 'quick'>('standard');
  const [busy, setBusy] = useState(false);

  const ready = couples.every((c) => c.players.every((p) => p.trim()));
  const update = (i: number, fn: (c: (typeof couples)[number]) => void) =>
    setCouples((prev) => prev.map((c, j) => (j === i ? (fn((c = structuredClone(c))), c) : c)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = couples.map((c, i) => ({
        name: c.name.trim() || `${c.players[0].trim()} & ${c.players[1].trim()}` || `Couple ${i + 1}`,
        players: c.players.map((p) => p.trim()) as [string, string],
      }));
      const res = await createRemoteGame(payload, { aiMode, length });
      setItem(hostKey(res.gameId), res.hostToken);
      if (aiMode) await new RemoteClient(res.gameId, { hostToken: res.hostToken }).generateAi();
      nav(`/host/${res.gameId}`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not create game');
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <Logo />
      <h1 className="text-4xl font-extrabold sm:text-5xl">Who’s playing?</h1>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {couples.map((c, i) => (
            <fieldset key={i} className={`card ${BG[COUPLE_COLOURS[i]]} p-4`}>
              <legend className="sr-only">Couple {i + 1}</legend>
              <input className="input mb-3 bg-white/80 font-display" placeholder={`Team name (optional)`} value={c.name} maxLength={40} onChange={(e) => update(i, (x) => (x.name = e.target.value))} aria-label={`Couple ${i + 1} team name`} />
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((j) => (
                  <input key={j} required className="input" placeholder={`Partner ${j + 1}`} value={c.players[j]} maxLength={30} onChange={(e) => update(i, (x) => (x.players[j] = e.target.value))} aria-label={`Couple ${i + 1} partner ${j + 1}`} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="card flex flex-col gap-4 bg-white p-5 sm:flex-row sm:items-center">
          <div className="grid flex-1 grid-cols-2 gap-2">
            {(['standard', 'quick'] as const).map((l) => (
              <button type="button" key={l} aria-pressed={length === l} className={`btn ${length === l ? 'btn-primary' : 'btn-plain'} px-2 text-base`} onClick={() => setLength(l)}>
                {l === 'standard' ? 'Standard ~40m' : 'Quick ~20m'}
              </button>
            ))}
          </div>
          <button type="button" aria-pressed={aiMode} className={`btn flex-1 ${aiMode ? 'btn-go' : 'btn-plain'} text-base`} onClick={() => setAiMode(!aiMode)}>
            {aiMode ? '✨ AI writes fresh questions' : '📦 House questions'}
          </button>
        </div>
        <button className="btn btn-hot text-2xl" disabled={!ready || busy}>
          {busy ? 'Setting up…' : 'Create room →'}
        </button>
      </form>
      <Toast msg={toast.msg} />
    </main>
  );
}
