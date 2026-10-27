import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameClient } from './client';
import { ApiError } from './client';
import type { Expect, PublicSnapshot } from '../shared/types';

export function useSnapshot(client: GameClient | null): PublicSnapshot | null {
  const [snap, setSnap] = useState<PublicSnapshot | null>(null);
  useEffect(() => (client ? client.subscribe(setSnap) : undefined), [client]);
  return snap;
}

export const expectOf = (s: PublicSnapshot): Expect => ({
  phase: s.phase,
  roundIndex: s.round?.index ?? 0,
  qIndex: s.qIndex,
});

/** Wrap async actions: one in flight at a time, stale (double-tap) errors swallowed, others toasted. */
export function useAction(onError: (msg: string) => void) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'stale')) onError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [onError],
  );
  return { busy, run };
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  return { msg, show: useCallback((m: string) => setMsg(m), []) };
}
