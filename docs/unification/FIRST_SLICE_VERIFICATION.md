# First Unification Slice Verification

## Repository Evidence

- Platform base: `d36515aef6366155698b6d91df7b328605589bf5` (`codex/practice-vertical-slice-hardening`).
- Club default reference: `78b4b256d0cb0f07a859f86d0d3ac246a5c515b6`.
- Club Practice reference: `875f6adfb4468ede192174d6ad46c860693ff167`.
- Club Ranked reference: `56184968bc72ed266a6e95d81c115d97b7d78429`.
- Club source and Git history were inspected but not modified or merged.

The Club Ranked branch provided future service-design evidence only. It had disposable local Supabase verification, not hosted development verification. Ranked is not implemented, deployed, enabled, or represented as live in Platform.

## Implemented Slice

- A compact Club-branded Next.js frame wraps Platform routes.
- `/club` is a dynamic server-rendered route backed by completed persisted game reviews.
- `/` remains the existing authoritative Practice game behind a thin route and feature boundary.
- The Practice setup toolbar is a separate component; its callbacks still invoke the existing command path.
- Pure profile, table, and replay adapters expose Platform facts in Club-facing presentation models.
- Unavailable competition and catalog concepts have no links and carry Preview or Soon labels.

## Real Data Flow

`/club` calls `loadProfileProjectionBundle`, which reads complete games from the configured Platform `EventStore`, reconstructs each `GameReview` from immutable move events, and invokes existing profile aggregate/detail projections. The route does not call Club mock data and does not synthesize ratings, ranks, streaks, achievements, or match records.

The route is explicit about its current identity boundary: it displays the local South-seat Practice profile and states that accounts are not connected. Empty storage produces an honest zero-game state. Store or reconstruction failures enter the route error boundary instead of substituting data.

## Presentation Boundary Evidence

- Table legality comes from `legalActionsForPlayer` and existing Platform table projections.
- Opponent seats expose counts and public role state, not hand cards.
- Viewer cards and public trick cards are defensively cloned so UI mutation cannot alter engine state.
- Viewer-relative seat rotation preserves immutable seat and team identifiers.
- Replay summaries carry through review winners, scores, bids, and tricks without calculating outcomes.
- Hidden dealer discard is omitted from the Club replay presentation model.

## Automated Verification

Run on Windows with Node and npm versions already used by this repository:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run simulate -- --games 10000 --seed 12345 --target-score 10 --stick-dealer true
npm.cmd run playtest -- --games 10000 --seed 12345 --target-score 10 --stick-dealer true --bot-policy intermediate-v1 --invariants strict
git diff --check HEAD
```

Results on 2026-07-22:

- Clean install passed: 435 packages added, 436 audited.
- Typecheck passed.
- ESLint passed.
- Vitest passed: 26 files, 249 tests.
- Next.js 15.5.19 production build passed; `/club` is dynamic and `/` remains static.
- Simulation passed: 10,000 games, 117,558 hands, zero illegal moves, zero failed games.
- Strict playtest passed: 10,000 completed games, 120,284 hands, zero failed games.
- Whitespace check passed.

This repository has no formatter script and no configured browser-test script. No command was invented or reported as passing. `npm ci` reports the pre-existing dependency audit finding of 10 vulnerabilities (4 moderate, 5 high, 1 critical) and blocked install-script warnings for `esbuild`, `sharp`, and `unrs-resolver`; the production build still completed successfully.

## Browser Verification

The built Next.js runtime was inspected with headless Chromium at 1440x1000 and 390x844.

- `/club` and `/` returned HTTP 200.
- Both routes rendered expected titles, headings, and active navigation.
- Ranked Solo, Replays, Tournaments, and Decks were visibly unavailable.
- No browser console errors or Next.js error overlay appeared.
- Neither desktop nor mobile produced document-level horizontal overflow.
- Mobile navigation moved from `/club` to `/` and updated the active item.
- A fixed-seed Practice start created a persisted Hand 1 and reached human-action controls.

## Remaining Boundaries

- There is no authenticated profile identity yet; current aggregates represent fixed local seats.
- The full table remains in the Practice feature module and should be split into dedicated table, seat, score, trick, hand, bidding, review, and persistence components in the next UI slice.
- Native replay and profile-detail routes are not yet implemented.
- There is no room, realtime, matchmaking, tournament, leaderboard, season, or cosmetics service.
- Ranked remains disabled because Platform does not yet have the required authenticated event-service boundary or hosted development proof.
- Operational logging, moderation, abuse controls, DDoS protection, backup/recovery, and production deployment are outside this slice.
