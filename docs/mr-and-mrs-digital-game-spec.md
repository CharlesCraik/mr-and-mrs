# Mr & Mrs Digital Party Game --- Product Brief & MVP Specification

## 1. Product overview

Build a mobile-first web app for **four couples (eight players)** to
play a digital couples quiz together during a holiday. The game is
inspired by the broad format of the *Mr & Mrs* party/board game:
partners predict each other's answers, answer simultaneously, and
discover how well their answers match.

The experience should feel like a lively hosted party game, not a formal
survey. Questions should spark funny reveals, friendly disagreements,
stories and discussion.

**Working concept:** a host starts a game, adds four couples, and runs
rounds from one shared screen. Players can submit answers privately on
their own phones where practical, or the host can manage answers if the
group prefers a simpler no-login setup.

This is a fan-made game concept inspired by general couples-quiz
mechanics. Do not copy the original game's exact question cards,
artwork, branding, wording or proprietary assets.

## 2. Goals

-   Make it easy for eight people to start playing within a few minutes.
-   Support four couples competing for a shared score.
-   Keep predictions and simultaneous answers hidden until the reveal.
-   Generate fresh, varied questions using the OpenAI API.
-   Include questions that have more than one reasonable answer and can
    be discussed afterwards.
-   Keep the rules understandable when people are chatting and playing
    on holiday.
-   Work well on phones, tablets and a laptop/TV used by the host.

## 3. Non-goals for the MVP

-   Public matchmaking, accounts, profiles or social feeds.
-   Real-money betting or complex progression.
-   Recreating the original board, cards, exact question bank or branded
    presentation.
-   Voice recognition, video calls or automatic judging of subjective
    answers.
-   Requiring every player to create an account.

## 4. Recommended setup

-   **Players:** 8 people, organised into 4 couples.
-   **Host:** one of the eight players can host, although a separate
    host is ideal. If one of the players hosts, the app should minimise
    the host's advantage by keeping answers hidden until locked.
-   **Devices:** one host screen plus one phone per player is ideal. A
    shared-device mode should also be available as a fallback.
-   **Session:** one room code or QR code; no account required.
-   **Duration:** target 30--45 minutes, configurable to a shorter game.

## 5. Core game loop

1.  Host creates a room and enters the names of four couples.
2.  Players join using a room code or QR code and select their name.
3.  Host selects a game length and question categories.
4.  The app explains the current round and presents each question.
5.  Players submit answers privately or simultaneously.
6.  The host reveals answers, awards points automatically where
    possible, and invites the group to discuss the result.
7.  The leaderboard updates after each question or round.
8.  The game ends with final standings and a playful winner screen.

No answer should be visible to another player before the reveal phase,
except where a round deliberately requires simultaneous public answers.

## 6. Game modes / rounds

Use a configurable set of rounds. For the default game, run four rounds
in this order.

### Round 1 --- How Well Do You Know Your Partner?

**Purpose:** test how accurately each player can predict their partner's
preferences, habits and opinions.

For each couple, run a question with two distinct prompts: -
**Prediction:** Player A answers what they think Player B would say. -
**Partner answer:** Player B answers for themselves, without seeing
Player A's prediction.

Then repeat with roles reversed, so both people in the couple predict
and answer.

**Flow** 1. Show the question to the predicting player privately. 2.
They submit their prediction. 3. Show the same question to their partner
privately. 4. The partner submits their own answer. 5. Lock both answers
and reveal them side by side. 6. Award a point if the answers match
according to the question's matching rule.

Questions can be free text, multiple choice or a ranked/short-list
answer. Prefer multiple choice for fast scoring and free text when the
question benefits from personal answers.

**Matching rules** - Multiple choice: exact option match. - Short text:
normalise case and whitespace; allow clear equivalent answers to be
accepted by the players or host. - Subjective answers: allow the couple
to agree whether the answers count as a match. Do not pretend the AI can
objectively decide personal compatibility.

### Round 2 --- Same Answer

**Purpose:** see whether partners agree when answering the same prompt
at the same time.

Both partners answer privately before either answer is revealed. For the
classic feel, the host can then reveal both answers together. In
shared-device mode, players can write down answers or use separate turns
with the screen hidden.

**Scoring:** one point when both answers match. Questions may use: - Yes
/ No - A choice between two or four options - A short text answer - A
scale, such as 1--5, where the same score is a match

Use lively prompts that encourage reactions, not only factual questions.

### Round 3 --- How Well Do You Know Your Partner? (Second Set)

Repeat the core mechanic from Round 1 with new questions and preferably
different categories. Do not reuse questions already seen in the current
session.

This round can be shorter than Round 1 if the host has selected a quick
game.

### Round 4 --- It's a Match (Discussion / True-or-False)

**Purpose:** create discussion and reward agreement, including when both
partners have the same opinion even if that opinion is not a factual
truth.

Each couple receives a statement or question. Both partners privately
choose **True / Agree** or **False / Disagree** before revealing.

**Suggested scoring** - Both choose True/Agree: 2 points if the
statement is factually true, when it has an objectively verifiable
answer. - Both choose False/Disagree: 1 point if the statement is
factually false, when it has an objectively verifiable answer. - If
answers differ: 0 points. - For opinion-based statements with no
objective truth, award 2 points for matching answers regardless of which
option they chose.

Important: label the question type clearly. Never score a subjective
opinion as factually right or wrong.

### Optional bonus round --- The Group Debate

Display a question with no single correct answer. Each couple privately
chooses an answer, then all answers are revealed. The host invites each
couple to explain their reasoning.

This round can be scored by a group vote, but the default should be
**discussion-only** to avoid arguments over subjective judgement.

## 7. Question design and AI generation

Use the OpenAI API to generate fresh questions on demand. AI output must
be structured and validated before it is shown in the game.

### Question principles

Questions should be: - Understandable immediately when read aloud. -
Specific enough to answer, but open enough to provoke conversation. -
Playful, varied and suitable for a mixed group of adult friends. -
Focused on preferences, habits, hypothetical situations, memories,
values, everyday decisions and light disagreements. - Free of assumed
gender roles; use "partner" rather than assuming a particular role for
either person. - Non-repetitive within a session. - Answerable without
specialist knowledge unless the host selects a trivia category. -
Designed so neither answer is inherently embarrassing or "wrong".

### Suggested categories

1.  **Everyday Habits** --- routines, tidiness, punctuality,
    decision-making.
2.  **Preferences** --- food, holidays, entertainment, ideal weekends.
3.  **Hypotheticals** --- what each person would do in an unusual
    situation.
4.  **Relationship Lore** --- shared memories and who is more likely to
    do something.
5.  **Money & Priorities** --- low-stakes spending choices and what
    feels worth paying for.
6.  **Travel & Adventure** --- planning styles, comfort zones, dream
    trips.
7.  **Would You Rather?** --- two equally tempting or difficult options.
8.  **Friendly Debates** --- questions with reasonable arguments on both
    sides.
9.  **Future Predictions** --- how the couple might respond to a future
    scenario.
10. **Spicy but Safe** --- cheeky adult humour, only if the host enables
    it.

Include category toggles and a "keep it friendly" default. The host
should be able to exclude sensitive categories.

### Questions that invite discussion

Examples below are original illustrative prompts, not a required fixed
question bank:

-   If you had an unexpected £500 to spend together this weekend, what
    would your partner choose to do with it?
-   Which of you would cope better if your flight was cancelled and you
    had to reorganise the whole holiday?
-   If you could only keep one for a year, which would your partner
    choose: eating out, travelling, or buying new things?
-   What would your partner say is your most predictable habit?
-   If you had to move abroad next month, which country would your
    partner pick first?
-   Which would matter more to your partner in a dream home: location,
    space, or character?
-   If you were both given a free day with no responsibilities, how
    would your partner most want to spend it?
-   Which of you would be more likely to start a conversation with a
    stranger on holiday?
-   Would your partner rather have an extremely organised trip or leave
    most plans open?
-   Which small everyday inconvenience would annoy your partner more:
    being late, a messy kitchen, or a slow internet connection?
-   If you had to enter a friendly competition as a couple, which type
    would your partner choose: physical challenge, quiz, creative task,
    or strategy game?
-   What is one thing your partner thinks you are much better at than
    you realise?

Avoid questions that pressure people to disclose secrets, compare
partners' attractiveness, reveal private sexual history, expose
financial details, or discuss trauma. Provide a skip option without
penalty.

### Suggested OpenAI prompt contract

The server should request JSON output using a schema equivalent to:

``` json
{
  "questions": [
    {
      "id": "unique-id",
      "roundType": "partner_prediction",
      "category": "hypotheticals",
      "prompt": "If you had an unexpected £500 to spend together this weekend, what would your partner choose to do with it?",
      "answerFormat": "short_text",
      "options": [],
      "matchingRule": "host_or_couple_confirmed",
      "discussionPrompt": "What made you think they would choose that?",
      "sensitivity": "general"
    }
  ]
}
```

Use a strict schema in the API request where supported. Validate the
response server-side; reject malformed, duplicated or unsuitable
questions and retry with a limited number of attempts. Never trust
generated content to be valid just because it came from the model.

The `roundType` values should be restricted to known enums, for
example: - `partner_prediction` - `same_answer` - `true_false_match` -
`discussion`

For true/false rounds, include `statementType` (`objective` or
`subjective`) and `correctAnswer` only for objective questions. For
subjective questions, score matching opinions rather than factual
correctness.

### AI generation settings

-   Generate a batch of questions per session rather than calling the
    API for every question.
-   Ask for more questions than needed, then validate and select a
    varied subset.
-   Avoid repeating prompts in a session using a normalised text
    comparison and stored question IDs.
-   Allow the host to regenerate a question before it is shown.
-   Offer a "less personal / more silly / more debate-worthy" tone
    selector.
-   Use a server-side API route or serverless function. **Never expose
    the OpenAI API key in browser code.**
-   Set request timeouts, rate limits and sensible token limits.
-   Provide a small fallback bank of original questions if the API
    fails.
-   Do not send player names or other identifying information to the
    model unless needed. Questions should be generic and reusable.

## 8. Scoring and leaderboard

Default scoring should be easy to explain: - Correct partner prediction
/ matching answer: **1 point**. - Same Answer match: **1 point**. - It's
a Match objective statement: **2 points for matching a true statement, 1
point for matching a false statement**, if the game is using this
classic-inspired scoring mode. - It's a Match subjective statement: **2
points if both partners choose the same side**. - Skipped question: **0
points**, no penalty.

Show: - Current score for each couple. - Round progress. - A simple
end-of-game leaderboard. - Optional per-round breakdown.

Tie-breaker: one final simultaneous-answer question. If tied couples
match, continue with another question until the host ends the tie-break.
Do not use a subjective AI judgement as a tie-breaker.

## 9. Host controls

The host should be able to: - Create and close a room. - Add, rename and
reorder the four couples. - Choose standard, quick or custom game
length. - Select question categories and tone. - Start, pause, skip or
restart a question. - Reveal answers only after submissions are
locked. - Confirm subjective matches and manually correct a score. -
Regenerate a question before it is answered. - Move to the next round. -
View and reset the leaderboard. - End the game and show winners.

Ask for confirmation before resetting a game or deleting a room.

## 10. Player experience and screen list

### A. Welcome / Create game

-   Game title and short explanation.
-   "Create game" primary action.
-   "Join game" action for other players.
-   No account requirement.

### B. Lobby

-   Room code and QR code.
-   Four couple slots with player names.
-   Clear joined / not joined status.
-   Host settings for game length, categories and tone.
-   Start button enabled when all eight players are assigned, with a
    host override for shared-device mode.

### C. Join flow

-   Enter room code or scan QR.
-   Choose a player name from the available slots or enter a display
    name.
-   Confirm couple assignment.
-   Prevent the same player slot from being claimed twice.

### D. Round intro

-   Round name.
-   One-sentence explanation.
-   How scoring works.
-   "Start round" button.

### E. Question / answer

-   Large readable question text.
-   Clear answer input controls.
-   Submission confirmation.
-   No other player's answer visible before reveal.
-   Skip option.
-   Progress indicator.

### F. Reveal

-   Show both partners' answers side by side.
-   Highlight match / no match.
-   Show scoring explanation.
-   Include an optional discussion prompt.
-   Host confirms any subjective match before awarding points.

### G. Leaderboard

-   Four couples and scores.
-   Current round and progress.
-   "Continue" action for host.

### H. Results

-   Final ranking and winner.
-   Optional funniest mismatch / most matched round, based on
    transparent rules.
-   "Play again" button that generates a fresh question set.

## 11. Technical recommendation

For a fast MVP, build a responsive web app that can be opened from a QR
code and run in a mobile browser.

A practical stack: - **Frontend:** React with TypeScript, using a
mobile-first component system. - **Backend / database / realtime:**
Supabase for room state, player assignments, answers, scores and
realtime updates. - **AI:** OpenAI API called only from a server-side
function. - **Hosting:** deploy frontend and server-side functions on a
platform compatible with the chosen stack; keep secrets in environment
variables. - **Room access:** short random room code plus a separate,
unguessable room/session token where appropriate. - **Realtime:**
subscribe to room and round state changes so the host screen and player
phones update together.

If the developer already has a preferred framework, use it rather than
adding unnecessary complexity. The core requirement is a reliable shared
game state and private answer submission.

### Data model (suggested)

**games** - `id` - `room_code` - `status` (`lobby`, `in_progress`,
`finished`) - `host_token_hash` - `settings_json` - `current_round` -
`current_question_index` - `created_at` - `expires_at`

**couples** - `id` - `game_id` - `display_name` - `sort_order`

**players** - `id` - `game_id` - `couple_id` - `display_name` -
`session_token_hash` - `joined_at` - `is_connected`

**questions** - `id` - `game_id` - `round_type` - `category` -
`prompt` - `answer_format` - `options_json` - `matching_rule` -
`statement_type` - `correct_answer` - `discussion_prompt` -
`order_index`

**answers** - `id` - `game_id` - `question_id` - `player_id` -
`answer_json` - `submitted_at` - `is_locked`

**scores** - `id` - `game_id` - `couple_id` - `question_id` -
`points_awarded` - `reason` - `confirmed_by_host` - `created_at`

Use database constraints to prevent duplicate answers for the same
player/question and duplicate score awards for the same couple/question.
Use Row Level Security and server-side validation so players can submit
their own answers but cannot read their partner's hidden answer before
reveal or modify scores directly.

For a very small prototype, some data can be represented as JSON within
a game session, but do not sacrifice answer privacy or score integrity.

## 12. Important game-state rules

Represent the game as explicit states, for example: - `lobby` -
`question_open` - `answers_locked` - `reveal` - `round_complete` -
`game_complete`

Rules: - A player can submit one answer per question. - A player may
edit their answer only before locking, if the host has enabled edits. -
Once the host locks the question, answers cannot be changed. - Reveal is
allowed only after all required answers arrive or the host explicitly
proceeds. - Missing or disconnected players should not block the game
indefinitely; host can wait, skip or proceed. - Scoring should be
idempotent, so repeated button presses cannot award points twice. - Do
not reveal hidden answers through client-side state, API responses,
realtime subscriptions or browser storage before the reveal phase. -
Rejoining with the same session token should restore a player's session.

## 13. Safety, privacy and group comfort

-   Keep the default question set suitable for a mixed group of adult
    friends.
-   Make any cheekier category opt-in.
-   Include a no-penalty skip action.
-   Avoid questions designed to provoke jealousy, expose secrets or
    embarrass someone.
-   Explain that answers are for fun and not a judgement of relationship
    quality.
-   Do not publish room answers or names publicly.
-   Expire rooms and delete session data after a short configurable
    period, unless the host explicitly chooses to save results.
-   Do not collect more personal data than the game needs.

## 14. Visual direction

Aim for a **warm, playful, modern game-night aesthetic**: - Strong,
legible typography and oversized question cards. - Bold colour blocks,
clear contrast and large tap targets. - Friendly illustrations or simple
abstract shapes rather than copied board-game art. - Small celebratory
animations for matches and score changes; keep them quick and
optional. - Distinct visual states for waiting, submitted, revealed and
matched. - A large host view suitable for a laptop or TV, alongside
compact player views for phones. - Avoid a corporate dashboard look.
This should feel like a party game.

Accessibility basics: - Good text contrast and scalable type. - Do not
use colour alone to communicate a match. - Buttons large enough for
one-handed use. - Support reduced-motion preferences. - Keep question
wording readable without horizontal scrolling.

## 15. MVP build plan for Claude Code

Build in small, testable phases. Do not start with AI generation before
the basic game loop works.

### Phase 1 --- App foundation

-   Set up frontend, TypeScript, styling and environment configuration.
-   Build welcome screen and responsive layout.
-   Add local mock data for four couples and sample questions.
-   Implement reusable question, answer, reveal and leaderboard
    components.

**Acceptance criteria:** app works on phone and desktop; users can
navigate a mocked game without backend services.

### Phase 2 --- Game logic

-   Implement game state machine.
-   Implement four rounds and their scoring rules.
-   Add answer submission, locking, revealing and subjective match
    confirmation.
-   Add unit tests for scoring and state transitions.

**Acceptance criteria:** a complete game can be played locally with all
four couples; no question can award points twice.

### Phase 3 --- Multiplayer rooms

-   Add Supabase schema, RLS policies and realtime subscriptions.
-   Create room and join flows with room code / QR code.
-   Add player session tokens and reconnect handling.
-   Keep answers private until reveal.

**Acceptance criteria:** eight players can join from separate devices;
submissions appear to the host; no player can see hidden answers or
alter another player's score.

### Phase 4 --- AI question generation

-   Add server-side OpenAI integration.
-   Create validated structured question schema and prompt templates for
    each round.
-   Add category and tone settings, deduplication and fallback
    questions.
-   Add host regeneration before a question begins.

**Acceptance criteria:** the API returns valid questions for every
supported round type; malformed responses are rejected; a game remains
playable if AI generation fails.

### Phase 5 --- Polish and holiday testing

-   Improve lobby, reveal animations and leaderboard.
-   Add skip, pause, reconnect and tie-breaker handling.
-   Test on iOS Safari and Android Chrome, including small screens.
-   Run a full eight-player playtest and fix confusing transitions.
-   Add room expiry and basic rate limiting.

**Acceptance criteria:** eight people can create/join a room, complete
all rounds, see accurate scores and reach results without developer
intervention.

## 16. Test scenarios

-   All eight players join and are assigned to four couples.
-   One player disconnects after joining and reconnects.
-   One player never submits an answer.
-   The host tries to reveal before answers are locked.
-   A player attempts to view a partner's answer before reveal.
-   A player submits twice or changes an answer after lock.
-   A subjective match is accepted and rejected by the host.
-   An AI response contains duplicate, malformed or inappropriate
    questions.
-   The OpenAI API times out or returns an error.
-   The host double-clicks the scoring/continue button.
-   The game is refreshed on the host device.
-   A tie occurs at the end.
-   The room expires and can no longer be joined.

## 17. MVP definition of done

The MVP is ready when: - Four couples can play together from separate
phones. - The host can run all four rounds. - Answer privacy and reveal
order work correctly. - Scores are calculated consistently and can be
corrected by the host. - AI-generated questions are varied, valid and
appropriate to the selected settings. - Every question can be skipped. -
The game works if AI generation temporarily fails. - The experience is
usable on mobile without installation or account creation. - A complete
session can be played in approximately 30--45 minutes.

## 18. Product principle

**The goal is not to prove which couple knows each other best. It is to
create funny reveals and conversations.** Optimise for quick rounds,
surprising differences, friendly debate and a smooth shared experience.
Keep the rules simple enough that everyone can understand them after one
explanation.
