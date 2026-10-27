import { z } from 'zod';
import type { Config } from '@netlify/functions';
import {
  applyHost,
  applyPlayer,
  createGame,
  GameError,
  replaceCurrentQuestion,
  selectQuestions,
  spareQuestion,
  startGame,
  toPublic,
} from '../../src/shared/engine';
import { ALL_BANK, BANK, BANK_TIEBREAK } from '../../src/shared/bank';
import { CATEGORIES, type GameState, type HostAction } from '../../src/shared/types';
import { db, errorResponse, hashToken, json, loadGame, mutate, newRoomCode, newToken, publish, tokenMatches } from '../lib/store';

const settingsSchema = z
  .object({
    length: z.enum(['standard', 'quick']),
    aiMode: z.boolean(),
    tone: z.enum(['silly', 'debate', 'gentle']),
    categories: z.array(z.enum(CATEGORIES)).min(1),
    spicy: z.boolean(),
    allowEdits: z.boolean(),
  })
  .partial();

const name = z.string().trim().min(1).max(40);
const expect = z.object({
  phase: z.enum(['lobby', 'round_intro', 'question_open', 'answers_locked', 'reveal', 'round_complete', 'game_complete']),
  roundIndex: z.number().int(),
  qIndex: z.number().int(),
});

const hostActionSchema: z.ZodType<HostAction> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rename_couple'), coupleId: z.string(), name }),
  z.object({ type: z.literal('rename_player'), playerId: z.string(), name }),
  z.object({ type: z.literal('update_settings'), settings: settingsSchema }),
  z.object({ type: z.literal('start_round'), expect }),
  z.object({ type: z.literal('lock'), expect }),
  z.object({ type: z.literal('reveal_next'), expect }),
  z.object({ type: z.literal('confirm'), expect, coupleId: z.string(), match: z.boolean() }),
  z.object({ type: z.literal('skip_question'), expect }),
  z.object({ type: z.literal('next'), expect }),
  z.object({ type: z.literal('adjust'), coupleId: z.string(), delta: z.number().int().min(-5).max(5) }),
  z.object({ type: z.literal('pause'), paused: z.boolean() }),
  z.object({ type: z.literal('end') }),
  z.object({ type: z.literal('reset') }),
]) as z.ZodType<HostAction>;

const gameId = z.string().uuid();
const token = z.string().min(10).max(100);

const bodySchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create'),
    couples: z.array(z.object({ name, players: z.tuple([name, name]) })).length(4),
    settings: settingsSchema.optional(),
  }),
  z.object({ op: z.literal('lookup'), roomCode: z.string().trim().length(4) }),
  z.object({ op: z.literal('snapshot'), gameId }),
  z.object({ op: z.literal('claim'), gameId, playerId: z.string(), playerToken: token.optional() }),
  z.object({ op: z.literal('player'), gameId, playerId: z.string(), playerToken: token, value: z.string().max(80).nullable() }),
  z.object({ op: z.literal('host'), gameId, hostToken: token, action: hostActionSchema }),
  z.object({ op: z.literal('release'), gameId, hostToken: token, playerId: z.string() }),
  z.object({ op: z.literal('start'), gameId, hostToken: token }),
  z.object({ op: z.literal('regenerate'), gameId, hostToken: token }),
]);

function requireHost(row: { host_token_hash: string }, hostToken: string) {
  if (!tokenMatches(hostToken, row.host_token_hash)) throw new GameError('invalid', 'Not the host');
}

function playerOf(state: GameState, playerId: string) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) throw new GameError('not_found', 'No such player');
  return p;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Bad request', detail: parsed.error.issues[0]?.message }, 400);
  const body = parsed.data;

  try {
    switch (body.op) {
      case 'create': {
        const id = crypto.randomUUID();
        const hostToken = newToken();
        for (let i = 0; i < 8; i++) {
          const roomCode = newRoomCode();
          const state = createGame(id, roomCode, body.couples, body.settings);
          const { error } = await db().from('games').insert({
            id,
            room_code: roomCode,
            host_token_hash: hashToken(hostToken),
            state,
            expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
          });
          if (error?.code === '23505') continue; // room code clash
          if (error) throw error;
          const snapshot = await publish(state, 0);
          return json({ gameId: id, roomCode, hostToken, snapshot });
        }
        throw new Error('Could not allocate a room code');
      }

      case 'lookup': {
        const { data, error } = await db()
          .from('games')
          .select('id')
          .eq('room_code', body.roomCode.toUpperCase())
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new GameError('not_found', 'No game with that code');
        return json({ gameId: data.id });
      }

      case 'snapshot': {
        const row = await loadGame(body.gameId);
        return json({ snapshot: { ...toPublic(row.state), rev: row.version } });
      }

      case 'claim': {
        const fresh = newToken();
        let issued = fresh;
        const snapshot = await mutate(body.gameId, (state) => {
          const s = structuredClone(state);
          const p = playerOf(s, body.playerId);
          if (p.claimed) {
            if (!tokenMatches(body.playerToken, p.tokenHash)) throw new GameError('taken', `${p.name} is already taken`);
            issued = body.playerToken!;
            return s;
          }
          issued = fresh;
          p.claimed = true;
          p.tokenHash = hashToken(fresh);
          return s;
        });
        return json({ playerToken: issued, snapshot });
      }

      case 'player': {
        const snapshot = await mutate(body.gameId, (state) => {
          if (!tokenMatches(body.playerToken, playerOf(state, body.playerId).tokenHash)) {
            throw new GameError('invalid', 'Rejoin the game to answer');
          }
          return applyPlayer(state, body.playerId, { type: 'answer', value: body.value });
        });
        return json({ snapshot });
      }

      case 'host': {
        const snapshot = await mutate(body.gameId, (state, row) => {
          requireHost(row, body.hostToken);
          return applyHost(state, body.action);
        });
        return json({ snapshot });
      }

      case 'release': {
        const snapshot = await mutate(body.gameId, (state, row) => {
          requireHost(row, body.hostToken);
          const s = structuredClone(state);
          const p = playerOf(s, body.playerId);
          p.claimed = false;
          p.tokenHash = null;
          return s;
        });
        return json({ snapshot });
      }

      case 'start': {
        const snapshot = await mutate(body.gameId, (state, row) => {
          requireHost(row, body.hostToken);
          const useAi = state.settings.aiMode && state.aiPool.length > 0;
          const plan = selectQuestions(state.settings, useAi ? state.aiPool : [], BANK, BANK_TIEBREAK);
          const aiUsed = plan.questions.filter((q) => q.source === 'ai').length;
          const note = !state.settings.aiMode
            ? null
            : aiUsed
              ? `${aiUsed} fresh AI questions in this game`
              : 'AI questions weren’t ready — playing the house questions';
          const s = startGame(state, plan, note);
          const usedIds = new Set(plan.questions.map((q) => q.id));
          s.aiPool = s.aiPool.filter((q) => !usedIds.has(q.id));
          return s;
        });
        return json({ snapshot });
      }

      case 'regenerate': {
        const snapshot = await mutate(body.gameId, (state, row) => {
          requireHost(row, body.hostToken);
          const spare = spareQuestion(state, ALL_BANK);
          if (!spare) {
            throw new GameError('invalid', state.settings.aiMode ? 'No spare questions left — skip this one instead' : 'No spare questions — turn on AI mode next game for more');
          }
          const s = replaceCurrentQuestion(state, spare);
          s.aiPool = s.aiPool.filter((q) => q.id !== spare.id);
          return s;
        });
        return json({ snapshot });
      }
    }
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: '/api/game' };
