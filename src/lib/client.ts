import { applyHost, applyPlayer, createGame, GameError, replaceCurrentQuestion, selectQuestions, spareQuestion, startGame, toPublic } from '../shared/engine';
import { ALL_BANK, BANK, BANK_TIEBREAK } from '../shared/bank';
import type { GameState, HostAction, PublicSnapshot, Settings } from '../shared/types';
import type { CoupleInput } from '../shared/engine';
import { supabase } from './supabase';
import { getItem, removeItem, setItem } from './session';

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

type Listener = (s: PublicSnapshot) => void;

/** One interface for the real multiplayer game and the single-device demo. */
export interface GameClient {
  readonly mode: 'local' | 'remote';
  subscribe(cb: Listener): () => void;
  host(action: HostAction): Promise<void>;
  answer(playerId: string, value: string | null): Promise<void>;
  start(): Promise<void>;
  regenerate(): Promise<void>;
  generateAi(): Promise<void>;
  release(playerId: string): Promise<void>;
}

// ---------- HTTP ----------

export async function api<T>(body: Record<string, unknown>, path = '/api/game'): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.status === 404 && !res.headers.get('content-type')?.includes('json')) {
    throw new ApiError('no_api', 'Game server not running — start with `npm run dev:full` (or use /demo)');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) throw new ApiError(data.code ?? String(res.status), data.error ?? 'Request failed');
  return data as T;
}

export async function createRemoteGame(couples: CoupleInput[], settings: Partial<Settings>) {
  return api<{ gameId: string; roomCode: string; hostToken: string; snapshot: PublicSnapshot }>({ op: 'create', couples, settings });
}

// ---------- Remote ----------

export class RemoteClient implements GameClient {
  readonly mode = 'remote' as const;
  private listeners = new Set<Listener>();
  private latest: PublicSnapshot | null = null;
  private teardown: (() => void) | null = null;

  constructor(
    public gameId: string,
    private auth: { hostToken?: string; playerId?: string; playerToken?: string } = {},
  ) {}

  setPlayer(playerId: string, playerToken: string) {
    this.auth = { ...this.auth, playerId, playerToken };
  }

  private push(s: PublicSnapshot) {
    if (this.latest && (s.rev ?? 0) < (this.latest.rev ?? 0)) return; // out-of-order
    this.latest = s;
    this.listeners.forEach((l) => l(s));
  }

  private async refresh() {
    try {
      const { snapshot } = await api<{ snapshot: PublicSnapshot }>({ op: 'snapshot', gameId: this.gameId });
      this.push(snapshot);
    } catch {
      /* transient — realtime or the next poll will catch up */
    }
  }

  private connect() {
    void this.refresh();
    const channel = supabase
      ?.channel(`game:${this.gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'public_games', filter: `id=eq.${this.gameId}` }, (payload) => {
        const snap = (payload.new as { snapshot?: PublicSnapshot }).snapshot;
        if (snap) this.push(snap);
      })
      .subscribe();
    // Holiday Wi-Fi is flaky: a slow poll + refresh-on-focus backs up realtime.
    const poll = setInterval(() => void this.refresh(), 8000);
    const onVis = () => document.visibilityState === 'visible' && void this.refresh();
    document.addEventListener('visibilitychange', onVis);
    this.teardown = () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVis);
      if (channel) void supabase?.removeChannel(channel);
    };
  }

  subscribe(cb: Listener) {
    this.listeners.add(cb);
    if (this.latest) cb(this.latest);
    if (!this.teardown) this.connect();
    return () => {
      this.listeners.delete(cb);
      if (!this.listeners.size) {
        this.teardown?.();
        this.teardown = null;
      }
    };
  }

  private async call(body: Record<string, unknown>) {
    const { snapshot } = await api<{ snapshot: PublicSnapshot }>({ gameId: this.gameId, ...body });
    this.push(snapshot);
  }

  host(action: HostAction) {
    return this.call({ op: 'host', hostToken: this.auth.hostToken, action });
  }
  answer(playerId: string, value: string | null) {
    return this.call({ op: 'player', playerId, playerToken: this.auth.playerToken, value });
  }
  start() {
    return this.call({ op: 'start', hostToken: this.auth.hostToken });
  }
  regenerate() {
    return this.call({ op: 'regenerate', hostToken: this.auth.hostToken });
  }
  release(playerId: string) {
    return this.call({ op: 'release', hostToken: this.auth.hostToken, playerId });
  }
  async generateAi() {
    // Background function: returns 202 immediately, progress arrives via aiStatus in the snapshot.
    await fetch('/.netlify/functions/generate-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: this.gameId, hostToken: this.auth.hostToken }),
    });
  }
}

// ---------- Local (single-device demo / hot-seat) ----------

const DEMO_KEY = 'mm:demo';

const DEMO_COUPLES: CoupleInput[] = [
  { name: 'The Tomatoes', players: ['Alex', 'Sam'] },
  { name: 'Sunny Side Up', players: ['Jo', 'Priya'] },
  { name: 'Teal Deal', players: ['Chris', 'Morgan'] },
  { name: 'Grape Expectations', players: ['Kim', 'Lee'] },
];

export class LocalClient implements GameClient {
  readonly mode = 'local' as const;
  private listeners = new Set<Listener>();
  private rev = 0;
  state: GameState;

  constructor(couples: CoupleInput[] = DEMO_COUPLES) {
    const saved = getItem<GameState>(DEMO_KEY);
    this.state = saved && saved.aiPool ? saved : createGame('demo', 'DEMO', couples, { length: 'quick' });
    this.state.players.forEach((p) => (p.claimed = true));
  }

  static clear() {
    removeItem(DEMO_KEY);
  }

  private set(next: GameState) {
    this.state = next;
    setItem(DEMO_KEY, next);
    const snap = { ...toPublic(next), rev: ++this.rev };
    this.listeners.forEach((l) => l(snap));
  }

  private run(fn: () => GameState) {
    try {
      this.set(fn());
      return Promise.resolve();
    } catch (e) {
      const err = e instanceof GameError ? new ApiError(e.code, e.message) : e;
      return Promise.reject(err);
    }
  }

  subscribe(cb: Listener) {
    this.listeners.add(cb);
    cb({ ...toPublic(this.state), rev: this.rev });
    return () => void this.listeners.delete(cb);
  }

  host(action: HostAction) {
    return this.run(() => applyHost(this.state, action));
  }
  answer(playerId: string, value: string | null) {
    return this.run(() => applyPlayer(this.state, playerId, { type: 'answer', value }));
  }
  start() {
    return this.run(() => startGame(this.state, selectQuestions(this.state.settings, [], BANK, BANK_TIEBREAK)));
  }
  regenerate() {
    return this.run(() => {
      const spare = spareQuestion(this.state, ALL_BANK);
      if (!spare) throw new GameError('invalid', 'No spare questions in the house bank');
      return replaceCurrentQuestion(this.state, spare);
    });
  }
  generateAi() {
    return Promise.reject(new ApiError('invalid', 'AI mode needs the online version'));
  }
  release() {
    return Promise.resolve();
  }
}
