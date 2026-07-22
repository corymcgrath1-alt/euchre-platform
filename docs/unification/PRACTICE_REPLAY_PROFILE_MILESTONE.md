# Practice, Replay, And Profile Milestone

## Authoritative State Audit

Before this milestone, `practice-client.tsx` contained table layout, seat identity, bidding, hand actions, trick animation, score display, status, review, profile summary, and persistence UI. Raw `GameState` reached several inline presentational functions. The full kitty was passed into the trick layout, the dealer discard could appear in activity/review output, and the rule summary exposed the deterministic deal seed.

After the refactor, raw authoritative state is limited to:

- `PracticeClient`, the trusted local Practice command/bot/persistence orchestrator;
- `buildClubTableView`, the one viewer-safe table adapter;
- replay reconstruction on the server, where cloned persisted events are applied through the Platform engine before safe projection;
- engine, persistence, review, and test code that owns canonical truth.

No Practice presentational module receives `GameState`, all hands, kitty card identities, or a hidden dealer discard.

## Practice Module Map

| Module | Responsibility | Input boundary |
| --- | --- | --- |
| `practice-client.tsx` | Canonical local orchestration, bot timing, command persistence, resume | `GameState`; never passed to child modules |
| `practice-table.tsx` | Table composition | `ClubTableView`, disabled flag, command callbacks |
| `practice-seats.tsx` | Viewer-relative seats, identity, card backs, role badges | Safe seat and bid decision views |
| `practice-bidding.tsx` | Bid timeline and engine-projected controls | Safe bidding/legal projections |
| `practice-hand.tsx` | Viewer hand, legal card buttons, discard and Farmer selection | Cloned viewer cards and legal IDs |
| `practice-trick.tsx` | Public center cards and presentation animation | Public trick projection and kitty count only |
| `practice-score.tsx` | Traditional five-card and numeric score | Engine-derived score view models |
| `practice-status.tsx` | Turn, game, rules, and redacted public activity | Safe status/rule/activity projections |
| `practice-review.tsx` | Completed review summary and replay link | Immutable `ClubReplayView` |
| `practice-persistence.tsx` | Resume/save status and clear-table control | IDs, status strings, narrow callback |
| `practice-profile.tsx` | Local persisted aggregate summary | Profile projections only |
| `practice-setup-toolbar.tsx` | Existing local rule and seed setup | Explicit setup primitives |

The action callback contract is centralized in `practice-actions.ts`. Components select and render engine-supplied legal actions; they do not reproduce Euchre legality.

## Viewer-Safe Table Flow

1. The local controller holds the current Platform `GameState`.
2. `buildClubTableView` calls existing Platform projections and `legalActionsForPlayer`.
3. The adapter clones the viewer hand and public cards, replaces opponent hands with counts, omits kitty identities, removes hidden discard/replacement identities, and removes deterministic seeds.
4. Viewer-relative positions are derived without changing real seats or teams.
5. Presentational modules receive only the immutable-shaped result and narrow callbacks.

The local Practice controller is intentionally a browser-local trusted runtime. It is not reused as a multiplayer authority. Hosted rooms require authenticated server-side command execution and viewer filtering before transport.

## Immutable Replay Flow

Route: `/club/replay/[reviewId]`.

1. The server loads one persisted Platform game and its append-only move events.
2. Events are defensively cloned and sorted by sequence.
3. `applyMoveEvent` reconstructs canonical state in order.
4. Bid, card-play, trick-complete, hand-score, and final-result steps are projected.
5. Every step passes through `buildClubTableView` for the local South viewer.
6. The server selects only the requested step before passing props to the client control island.

The client supports previous, next, and range-based timeline jumps. It never receives future steps, source events, canonical snapshots, other hands, kitty identities, a private discard, or the reproducible seed. Empty persisted games, unfinished games, malformed positions, missing reviews, loading, and unexpected errors have explicit states. App Router can stream a route-specific not-found boundary after the initial response begins; tests assert the not-found state rather than an unreliable document status.

## Profile Detail Flow

Route: `/club/profile/[profileId]`.

The server resolves only one of the four existing local Practice profile IDs, builds aggregates from completed persisted reviews, and maps them with `buildClubProfileDetailView`. The page displays supported identity, record, call/trick/loner totals, points, completed-game history, and native replay links. It explicitly identifies the profile as local and unauthenticated. Empty history, loading, not-found, and unexpected error states do not substitute fictional data.

## Hidden-Information Guarantees

- Opponent identities are represented by counts and card backs, never card values.
- Kitty identities are absent; only the public upcard and count are projected.
- Dealer discards and Farmer replacement cards are redacted from activity and replay details.
- Practice deal seeds are absent from table and replay projections.
- Viewer cards and public cards are cloned so presentation mutation cannot alter engine state.
- Different viewer seats produce different hands with stable relative orientation.
- Replay pages serialize one filtered step, not the full event stream or future table states.
- Legal card IDs and bid options originate from Platform legality projections.

## Routes And Availability

- `/`: complete local Practice.
- `/club`: persisted local Club dashboard.
- `/club/profile/[profileId]`: persisted local profile detail.
- `/club/replay/[reviewId]`: persisted immutable replay.

Primary navigation contains only Club and Practice. Ranked, private rooms, Partners, leaderboards, seasons, tournaments, cosmetics, hosted authentication, and realtime multiplayer remain absent and disabled.

## Browser Coverage

Playwright runs against `next build` plus `next start` on port 3005 with an isolated event-store file. Global setup creates real games through Platform APIs and completes a deterministic target-5 match through legal engine actions. Tests cover Practice setup/action, legal controls, DOM/storage privacy, replay stepping and final truth, private discard handling, honest replay failure states, persisted profile/replay links, route not-found states, desktop 1440x1000, and mobile 390x844. No live credentials or hosted services are used.

## Verification Record

Final verification was run on 2026-07-22 with Next.js 15.5.19, Vitest 2.1.9, Playwright 1.61.1, and installed Google Chrome 150.0.7871.181.

| Command | Result |
| --- | --- |
| `npm.cmd ci` | Passed; 438 packages installed and 439 audited from the lockfile |
| `git diff --check` | Passed |
| formatter | Not run because the repository has no formatter script |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed |
| `npm.cmd run test` | Passed; 27 files and 254 tests |
| `npm.cmd run build` | Passed; optimized Next.js production build with `/`, `/club`, profile detail, replay, API routes, and icon |
| `npm.cmd run e2e` | Passed; 5 built-runtime Chromium tests |
| `npm.cmd run simulate -- --games 10000 --seed 12345 --target-score 10 --stick-dealer true` | Passed; 10,000 games, 117,558 hands, 0 illegal moves, 0 failed games |
| `npm.cmd run playtest -- --games 10000 --seed 12345 --target-score 10 --stick-dealer true --bot-policy intermediate-v1 --invariants strict --out playtest-results/unification-v1-final` | Passed; 10,000 completed games, 120,284 hands, 0 failures |

Browser checks used 1440x1000 desktop and 390x844 mobile viewports. Practice asserted zero console errors and zero uncaught page errors. All tested routes had no document-level horizontal overflow; replay controls remained enabled and operable at both sizes. The tests inspect rendered HTML including Next.js serialized server-component data, local storage, legal/disabled controls, replay visibility at early and discard steps, final persisted truth, and honest unavailable/not-found states.

The clean install retains the existing audit report of 10 vulnerabilities (4 moderate, 5 high, 1 critical) and install-script warnings for `esbuild`, `sharp`, and `unrs-resolver`. This milestone did not perform a broad dependency/security upgrade. The Vite CJS API deprecation warning remains in the test runner. Build and runtime verification completed despite those warnings.

## Remaining Boundaries

This milestone does not add authentication, private rooms, Ranked, Partners, matchmaking, realtime, ratings activation, leaderboards, seasons, tournaments, cosmetics, moderation, anti-collusion, abuse controls, operational monitoring, deployment, or backup/recovery. Those capabilities require later server-authoritative services around the Platform event flow.
