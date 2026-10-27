import { z } from 'zod';
import { GameError } from '../../src/shared/engine';
import { ALL_BANK } from '../../src/shared/bank';
import { generateQuestions } from '../lib/ai';
import { loadGame, mutate, tokenMatches } from '../lib/store';

const MAX_GENERATIONS = 5;
const MAX_POOL = 80;

const bodySchema = z.object({ gameId: z.string().uuid(), hostToken: z.string().min(10).max(100) });

// Background function (up to 15 min): writes a fresh AI question batch into the game's private pool
// while the group is still in the lobby. Clients watch `aiStatus` in the public snapshot.
export default async (req: Request): Promise<void> => {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return;
  const { gameId, hostToken } = parsed.data;

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';

  try {
    const row = await loadGame(gameId);
    if (!tokenMatches(hostToken, row.host_token_hash)) return;

    let settings = row.state.settings;
    let avoid: string[] = [];
    await mutate(gameId, (state) => {
      if (state.generations >= MAX_GENERATIONS) throw new GameError('invalid', 'Generation limit reached');
      if (state.aiStatus === 'writing') throw new GameError('invalid', 'Already writing');
      const s = structuredClone(state);
      s.generations += 1;
      s.aiStatus = 'writing';
      s.aiNote = null;
      settings = s.settings;
      avoid = [...ALL_BANK, ...s.aiPool, ...Object.values(s.questions)].map((q) => q.prompt);
      return s;
    });

    try {
      if (!apiKey) throw new Error('OPENAI_API_KEY not set');
      const batch = await generateQuestions({ settings, avoidPrompts: avoid, apiKey, model });
      await mutate(gameId, (state) => {
        const s = structuredClone(state);
        s.aiPool = [...batch, ...s.aiPool].slice(0, MAX_POOL);
        s.aiStatus = 'ready';
        s.aiNote = `${batch.length} fresh questions written`;
        return s;
      });
    } catch (e) {
      console.error('AI generation failed', e);
      await mutate(gameId, (state) => {
        const s = structuredClone(state);
        s.aiStatus = s.aiPool.length ? 'ready' : 'failed';
        s.aiNote = 'AI is having a moment — the house questions are ready to go';
        return s;
      });
    }
  } catch (e) {
    if (!(e instanceof GameError)) console.error(e);
  }
};
