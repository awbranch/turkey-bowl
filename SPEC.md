# Turkey Bowl — Spec

A small web app for our family's annual day-after-Thanksgiving bowling tournament. It handles team setup, frame-by-frame score entry during play, live standings, and an end-of-night prize allocation that guarantees **every bowler gets at least one prize**, followed by an MC-driven awards ceremony.

---

## 1. Goals & non-goals

**Goals**
- Run the whole night from one admin iPad plus each team's scorer phone.
- Every roll is saved to the database as it's entered. Closing a tab or losing a phone never loses scores.
- Teams can be reshuffled between rounds; individual scores persist across rounds.
- Automatically propose a full prize list in which everyone gets at least one prize; admin reviews, then the MC reads it out.
- Keep history across years (people persist; events are per year).

**Non-goals**
- Real security / user accounts. One admin passcode; scorers get an unguessable link.
- Handicaps.
- Photo / OCR score capture (possible future stretch).
- Real-time sockets. Polling is enough for ~16 people.

---

## 2. Scale & assumptions

- 12–16 bowlers, teams of ~4 (so 3–4 teams; uneven teams are possible).
- 2–3 rounds. Each round = one game per bowler.
- Kids and adults bowl together.
- One admin (iPad). One scorer per team (their own phone). One MC (iPad or own phone).

---

## 3. Architecture

| Concern | Choice |
|---|---|
| Framework | Next.js 16, App Router, Server Actions, TypeScript |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM; migrations with `drizzle-kit generate` → `wrangler d1 migrations apply` |
| Styling | Tailwind CSS 4 |
| Validation | zod |
| Tests | vitest (scoring library + allocator are the critical units) |
| Package manager | pnpm |
| Environments | wrangler envs: local dev + production |

No CMS, no R2, no Durable Objects. The app is installed as a **PWA** (manifest + apple-touch-icon) so it opens full screen from the iPad home screen.

**Live updates:** the board, admin and MC/TV views poll (every ~5s) via `router.refresh()` or a lightweight fetch.

**Persistence:** every keypad tap triggers a Server Action that upserts that bowler's `rolls` for the round. The client also keeps a small localStorage outbox, and retries any unsent writes when the connection recovers. D1 is the source of truth.

### Domain logic lives in pure modules

```
src/lib/bowling/      rolls → frames, score, streaks, validation (pure, heavily tested)
src/lib/prizes/       prize registry + allocator + magic numbers (pure, heavily tested)
src/db/               drizzle schema, queries
src/app/              routes, server actions, UI
```

---

## 4. Access model

- **Admin:** `/login` takes a passcode (wrangler secret `ADMIN_PASSCODE`) and sets a signed, HTTP-only cookie (valid for several days). It covers setup, team management, score corrections, review and finalize.
- **Scorers:** each event has a random `score_token`. The iPad shows a QR code to `/s/[token]` at the start of each round. The scorer picks their team for the current round, and that choice is remembered in a cookie scoped to the round. The token stops working when the event is marked final.
- **MC:** `/mc/[mc_token]`, a separate random token so the MC can use their own phone without admin rights. The admin iPad can also open the MC view directly.

---

## 5. Data model

```
people
  id, name, nickname?, birthdate (required), created_at
  -- persists across years

events
  id, year, name, date, status (setup | live | review | final),
  score_token, mc_token,
  streak_tie_limit INTEGER DEFAULT 5,
  created_at

event_bowlers
  event_id, person_id            -- who is bowling this year
  PK(event_id, person_id)

rounds
  id, event_id, number (1..3), status (setup | bowling | done)

teams
  id, round_id, name, color

team_members
  team_id, person_id
  -- a person is on exactly one team per round

games
  id, round_id, person_id,
  rolls TEXT (JSON array),       -- source of truth
  score INTEGER,                 -- derived, cached on write
  complete BOOLEAN,              -- derived: 10 valid frames entered
  updated_at
  UNIQUE(round_id, person_id)

awards                           -- written at Finalize; the ceremony script
  id, event_id,
  kind (individual | team | note),
  prize_key, title,
  person_id?, team_id?,
  metric?, detail, script_line,
  sort_order, locked BOOLEAN,
  presented_at?, handed_out BOOLEAN
```

Team scores, streaks and standings are **always computed** from `games` + `team_members` and never stored.

---

## 6. Scoring

### Roll notation

Each roll in `rolls` is one of:

| Token | Meaning | Pins |
|---|---|---|
| `X` | Strike | 10 |
| `/` | Spare | remainder of frame |
| `G` | Gutter ball | 0 |
| `-` | Miss (not a gutter) | 0 |
| `1`–`9` | Pins knocked down | n |

`G` and `-` both score 0. They're kept separate so "gutters in a row" counts real gutters only. The scorer is watching the lane, so they know which it was.

### Rules

- Standard ten-pin scoring: strike bonus = next 2 rolls, spare bonus = next 1 roll.
- 10th frame: up to 3 rolls if a strike or spare is thrown.
- Validation: a frame can't exceed 10 pins, `/` only on a frame's 2nd roll (or valid 10th-frame positions), `X` only where a strike is possible.
- A game is **complete** when all 10 frames are entered.
- Frame-by-frame entry is **required** for every bowler. There's no "total only" fallback. If a scorer falls behind, the admin iPad can open any team's scorecard and enter or correct frames.
- A round can be marked **done** only when every bowler in it has a complete game.

### Streaks (computed per game, never across games)

- **Strikes in a row:** longest run of consecutive `X` rolls in the game, including 10th-frame bonus rolls (max 12).
- **Spares in a row:** longest run of consecutive frames that end in a spare.
- **Gutters in a row:** longest run of consecutive `G` rolls in the game (any roll position).

A bowler's streak value for a prize = their **best single-game streak** across all rounds.

### Team scores

- A team's round score = **average** of its members' game scores for that round (fair when teams are uneven). The board also shows the total.

---

## 7. Prizes

### 7.1 Fixed prizes (always awarded to the true winner(s); can stack)

| Prize | Ranking | Ties |
|---|---|---|
| Top 3 scores | highest bowler average per game across all rounds (same order as total when everyone bowls every round; fair if someone misses a round) | all tied bowlers win |
| Bottom 3 scores | lowest bowler average per game across all rounds | all tied bowlers win |
| Most strikes in a row | best single-game strike streak | all tied win, subject to tie limit |
| Most spares in a row | best single-game spare streak | all tied win, subject to tie limit |
| Most gutters in a row | best single-game gutter streak | all tied win, subject to tie limit |
| Oldest | earliest birthdate | all tied win |
| Youngest | latest birthdate | all tied win |

**Streak tie limit:** if more than `events.streak_tie_limit` (default **5**) bowlers tie for a streak prize, that category is **skipped** and an `awards` row of kind `note` is added to the MC's final wrap-up (e.g. *"Most Strikes in a Row: 8 of you managed one. We're calling it a family achievement 🦃"*). A streak of **0** is never awarded (e.g. nobody threw a gutter). That also goes in the wrap-up as a note.

### 7.2 Team prizes (announced only, no ornament)

- **Best Team** and **Worst Team** for **each round**, by team average (teams can reshuffle between rounds, so each round has its own pair).
- Team prizes **do not count** toward anyone's "has a prize" status.

### 7.3 Filler prizes (only for bowlers with no prize yet)

Filler prizes exist only to make sure everyone gets a prize. Accuracy doesn't matter: each filler goes to the **best-ranked bowler who has no prize yet**, even if that's not the true #1. A filler with no eligible bowler left is **dropped** and not announced.

Starting registry (priority order, editable per event):

1. **Bowled Your Age:** any game score closest to the bowler's age
2. **Most Improved:** biggest gain from first to last round
3. **Rollercoaster:** biggest swing between rounds
4. **Steady Eddie:** smallest spread between rounds
5. **Clean Game:** fewest open frames in a game
6. **Big Finish:** best 10th frame
7. **Slow Starter:** weakest first 3 frames compared to the rest of the game
8. **So Close:** most 9-pin first balls
9. **Leftovers:** most pins left standing on first balls
10. **Most Spares** (total, not streak)
11. **Birthday Closest to Thanksgiving**

### 7.4 Custom prizes

Before allocation, the admin can add judgment prizes (e.g. "Best Celebration", "Best Outfit") and pick the winner. These count as individual prizes.

### 7.5 Magic numbers (last resort)

Any bowler still without a prize after fixed, custom and filler prizes gets a **magic number** prize: "Closest to N." The numbers are kept secret until the ceremony, and N is chosen to land on that bowler:

- Candidate scores: any of the bowler's game scores.
- Prefer "fun" numbers near that score: round numbers (50, 100), repeated digits (111, 77), the year (126 for 2026), and so on.
- N must make the target bowler **strictly closest** among the bowlers who are still unprized, and the magic numbers must be distinct.
- Detail records which round's score matched.

### 7.6 Allocation pipeline

```
1. fixed prizes   → award all true winners (stacking ok, ties all win,
                    streak ties > limit skipped + MC note)
2. custom prizes  → admin-chosen winners
3. filler prizes  → in priority order, first-ranked bowler with no prize
4. magic numbers  → one per remaining prize-less bowler
5. team prizes    → appended, announce-only
```

The result: every bowler has at least one individual prize.

The allocator is a pure function `allocate(eventData, settings, locks) → ProposedAward[]`, so it's deterministic and fully unit-tested. Each prize implements:

```ts
type Prize = {
  key: string
  title: string
  tier: 'fixed' | 'filler' | 'team'
  rank(data: EventData): { personId?: string; teamId?: string; metric: number; detail: string }[]
  scriptLine(winner, data): string
}
```

---

## 8. Screens

### Admin (iPad, `/admin/...`)
- **Setup:** manage people (name, birthdate), create the event, choose who is bowling, filler prize order, custom prizes, streak tie limit.
- **Round teams** (`/admin/round/[n]/teams`): create teams, drag bowlers between them, **"Copy teams from last round"**.
- **Round control:** start the round (shows the scorer QR), see each bowler's progress, mark the round done.
- **Scorecard override:** open any bowler's game and edit frames.
- **Live board** (`/board`): standings by round and overall, individual and team.

### Scorer (phone, `/s/[token]`)
- Pick a team for the current round, then see that team's bowlers in lane order.
- Frame keypad: `X` `/` `G` `-` `1`–`9`, plus undo. Only valid keys are enabled for the current roll.
- A running scorecard per bowler that looks like the alley display.
- Saves on every tap and shows a saved/offline indicator.

### Review (iPad, `/admin/review`)
- Status bar: `N bowlers · N with a prize · 0 without · K notes`.
- Prize cards with winner, metric and reason (e.g. "Most spares in a row: Aunt Kim, 4 (Round 2)").
- Filler, custom and magic-number cards: tap the winner to pick from the ranked list, lock 🔒, rename, turn off.
- Fixed prize cards are read-only (ties and skipped categories are shown).
- Warnings: incomplete games, skipped streak categories.
- **Re-run** reallocates everything that isn't locked. Drag to set the ceremony order (default below). **Finalize** writes the `awards` rows.

**Default ceremony order:** fillers & custom → magic numbers → streaks → oldest/youngest → team prizes → bottom 3 → top 3 → wrap-up notes.

### MC (`/mc/[mc_token]`)
- One award at a time, in large type: number (e.g. 12 of 22), title, script line, **tap to reveal** the winner, `‹ prev` `next ›`.
- "Ornament handed out" checkbox per individual award.
- **Final wrap-up card:** skipped categories and other notes, plus a list of anyone without a "handed out" ornament.
- **Print view:** a one-page ordered list of every award, used as a Wi-Fi backup and for labeling ornaments in advance.

### TV (optional, `/tv/[mc_token]`)
- Mirrors the award the MC is currently showing (polls `presented_at`). Meant for AirPlay.

---

## 9. Event lifecycle

```
setup → live (round 1 bowling → done → teams for round 2 → … ) → review → final
```

- `final` disables the scorer token. The MC view and print view stay available.
- Next year: create a new event and reuse `people`.

---

## 10. Build order

1. **Scoring library + tests:** parse/validate rolls, frame building, score (including the 10th frame), streaks.
2. **Scaffold:** Next 16 + OpenNext + D1/Drizzle + Tailwind 4, wrangler envs, PWA manifest.
3. **Schema + admin setup:** people, events, rounds, teams, copy-teams.
4. **Scorer flow:** QR, team picker, keypad, autosave plus outbox.
5. **Live board + admin scorecard override.**
6. **Allocator + tests:** fixed, custom, filler, magic numbers, tie limit, notes.
7. **Review screen:** swaps, locks, re-run, ordering, finalize.
8. **MC view + wrap-up + print view.** TV view if there's time.

---

## 11. Decisions log

1. **Top 3 / Bottom 3** rank each bowler's results across all rounds (not single games), using **average per game**. This matches the total when everyone bowls every round, and stays fair if someone misses a round.
2. **Best/Worst Team** is announced **per round**.
3. **Missed rounds:** a bowler who misses a round is still ranked, by average per game across the rounds they bowled.
