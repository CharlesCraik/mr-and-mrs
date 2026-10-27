# Mr & Mrs Party

A couples party quiz for four couples: one TV/laptop runs the show, everyone answers on their own phone.
Spec: [docs/mr-and-mrs-digital-game-spec.md](docs/mr-and-mrs-digital-game-spec.md).

## Try it now (no backend)

```bash
npm install
npm run dev
```

Open http://localhost:5173/demo. It shows the TV view and a phone for any of the 8 players on one screen, using the 25 house questions.

## How it works

- **Rounds:** Know Your Partner → Same Answer → Know Your Partner 2 → It's a Match (true/false) → Bonus Group Debate. Tie-break round added automatically if the top is tied.
- **All couples play every question at once.** In prediction rounds one partner answers for themselves and the other guesses (roles swap every question).
- **Reveal:** host flips one couple at a time on the TV, then a discussion prompt appears.
- **Questions:** 25 hand-written house questions + 3 tie-breakers in `src/data/questionBank.json`. With **AI mode** on, a background function asks OpenAI for a fresh batch while everyone is in the lobby. The house bank fills any gap, so the game still works if AI fails.

## Architecture

| Piece | Where |
|---|---|
| Pure game engine (state machine, scoring, public snapshot) | `src/shared/engine.ts` |
| Question schema + validation (bank and AI output) | `src/shared/questionSchema.ts` |
| API: create/join/answer/host actions | `netlify/functions/game.ts` → `/api/game` |
| AI question writer (OpenAI Responses API, strict JSON schema) | `netlify/functions/generate-background.ts`, `netlify/lib/ai.ts` |
| Expired room cleanup (hourly) | `netlify/functions/cleanup.ts` |
| DB schema + RLS | `supabase/migrations/001_init.sql` |

**Privacy model:** the full game state, including hidden answers and tokens, lives in `games.state`. Only the service role can read it. Phones and the TV subscribe to `public_games.snapshot`, which never includes an answer before its reveal, a correct answer before its reveal, or a token. All writes go through the Netlify function, which checks the host/player token and applies the engine.
Concurrent answers use optimistic versioning with retry. Host actions carry the phase/question they expect, so double taps are rejected and points are never awarded twice.

## Deploy (Supabase + Netlify)

1. **Supabase:** create a project. In SQL editor run `supabase/migrations/001_init.sql`. This creates the tables and RLS policies and enables realtime on `public_games`.
2. **Netlify:** import the repo; build settings come from `netlify.toml`. Set these environment variables:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (browser)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (functions only)
   - `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-5-mini`; AI mode only)
3. Local full-stack dev: `npx netlify-cli dev` with a `.env` copied from `.env.example`.

> AI mode uses a Netlify **background function**, because generation takes longer than the synchronous function timeout. If your Netlify plan doesn't include background functions, AI mode will report "AI unavailable" and the game will use the house questions instead.

## Tests

```bash
npm test
```

Covers scoring for every round type, auto/forced locking, role swaps, stale/double-tap protection, hidden-answer snapshots, tie-breaks, question swaps, bank validation and AI response parsing/validation/retry.
