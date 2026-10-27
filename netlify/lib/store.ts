import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GameError, toPublic } from '../../src/shared/engine';
import type { GameState, PublicSnapshot } from '../../src/shared/types';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase env vars missing (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export const newToken = () => randomBytes(24).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export function tokenMatches(token: unknown, hash: string | null | undefined): boolean {
  if (typeof token !== 'string' || !hash) return false;
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const newRoomCode = () =>
  Array.from(randomBytes(4), (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');

interface GameRow {
  id: string;
  room_code: string;
  host_token_hash: string;
  state: GameState;
  version: number;
  expires_at: string;
}

export async function loadGame(gameId: string): Promise<GameRow> {
  const { data, error } = await db().from('games').select('*').eq('id', gameId).maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at) < new Date()) throw new GameError('not_found', 'Game not found or expired');
  return data as GameRow;
}

/** Write the public snapshot. Only ever moves forward: a slower, older write can't clobber a newer one. */
export async function publish(state: GameState, rev: number): Promise<PublicSnapshot> {
  const snapshot = { ...toPublic(state), rev };
  const row = { room_code: state.roomCode, snapshot, rev, updated_at: new Date().toISOString() };
  const { error } =
    rev === 0
      ? await db().from('public_games').insert({ id: state.id, ...row })
      : await db().from('public_games').update(row).eq('id', state.id).lt('rev', rev);
  if (error) throw error;
  return snapshot;
}

/**
 * Optimistic-concurrency update: re-read and re-apply on version clash so eight phones
 * answering at once never overwrite each other.
 */
export async function mutate(
  gameId: string,
  fn: (state: GameState, row: GameRow) => GameState | Promise<GameState>,
): Promise<PublicSnapshot> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const row = await loadGame(gameId);
    const next = await fn(row.state, row);
    const { data, error } = await db()
      .from('games')
      .update({ state: next, version: row.version + 1 })
      .eq('id', gameId)
      .eq('version', row.version)
      .select('id');
    if (error) throw error;
    if (data && data.length) return publish(next, row.version + 1);
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 120));
  }
  throw new Error('Too much contention, try again');
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof GameError) {
    const status = e.code === 'stale' ? 409 : e.code === 'not_found' ? 404 : e.code === 'taken' ? 409 : 400;
    return json({ error: e.message, code: e.code }, status);
  }
  console.error(e);
  return json({ error: 'Something went wrong', code: 'server' }, 500);
}
