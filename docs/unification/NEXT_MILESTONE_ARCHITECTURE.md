# Native Practice, Replay, and Profile Milestone

## Status

This document records the implementation boundary for the second Platform unification slice. Platform remains the only Next.js runtime and the only authority for Euchre rules, legal actions, state transitions, persistence, replay truth, profiles, ratings, and results.

## Initial audit

The existing Practice controller in `src/features/practice/practice-client.tsx` owns persisted command dispatch, bot scheduling, local resume state, and profile/review loading. It also contains the complete table presentation. The table presentation receives `GameState` directly, recomputes presentation projections, reads `state.hands`, and passes `state.kitty` into a child component. The inline review also reads the authoritative `dealerDiscard` field. Those crossings are the primary targets of this milestone.

The existing `buildClubTableView` adapter already derives legal actions from `legalActionsForPlayer`, clones visible cards, omits opponent hand identities, and emits seat card counts. It is the canonical starting point for the Practice presentation boundary.

The persisted event store is canonical replay input. `buildGameReview` deterministically replays immutable persisted actions through Platform `applyMoveEvent`; it is not a second rules implementation. The existing Club replay adapter omits dealer discard identity, but it exposes only completed-hand summaries rather than a navigable event timeline.

Profiles are fixed local Practice-seat projections derived only from completed persisted reviews. There is no authenticated identity, hosted profile, rating, rank, ownership, or competitive history.

## Module map

The Practice route remains a thin route boundary around a client controller. The controller retains only `ClubTableView` and an event count. `/api/games/[gameId]/practice` loads authoritative state, validates local-seat commands, chooses deterministic bot commands, appends events, and returns the filtered projection. Presentation is split into narrow modules:

- `practice-table`: composition of the safe table projection.
- `practice-seats`: seat identity, dealer/turn/caller badges, and hidden-card backs.
- `practice-bidding`: viewer legal bid/Farmer's Hand controls and public bidding timeline.
- `practice-hand`: viewer-visible cards and card-selection callbacks.
- `practice-trick`: public current/completed trick cards and public upcard/hidden kitty count.
- `practice-score`: score cards, table status, turn prompt, and hand/game status.
- `practice-review`: viewer-safe completed-review summary and native replay links.
- `practice-persistence`: local persisted-game and resume/reset status.

Presentational modules receive `ClubTableView` slices, explicit display primitives, readonly card views, and narrow callbacks. They do not receive `GameState`, raw hands, kitty card identities, or dealer discard identity.

## Table data flow

Persisted events -> server-side `GameState` -> `buildClubTableView(state, viewerSeat)` -> readonly viewer-safe response -> Practice controller and presentation modules.

The adapter is responsible for:

- copying visible viewer cards and public trick/upcard cards;
- representing opponents by card count only;
- representing the kitty by a hidden-card count and public upcard only;
- deriving legal card/bid/Farmer's Hand controls from `legalActionsForPlayer`;
- redacting dealer discard identity from activity and review presentation;
- cloning arrays and nested card values so UI mutation cannot affect engine state.

The controller resolves clicked card IDs against the authoritative viewer hand immediately before dispatch. Presenters never reconstruct legality.

## Replay data flow

Persisted Platform events -> `buildGameReview` using Platform replay/apply logic -> `buildClubReplayProjection(review, viewerSeat)` -> `/club/replay/[reviewId]`.

The projection creates a deterministic immutable sequence of deal, bid, card-play, trick-complete, hand-score, and game-complete steps. A step contains only public facts known at that point. Future plays, opponent hands, kitty identities, and dealer discard identity are absent. The final score and winner are copied from the canonical completed review.

## Profile data flow

Completed persisted Platform games -> `loadCompletedProfileSources` -> `buildPlayerProfileDetail` -> `/club/profile/[profileId]`.

Only fixed local profile identity and persisted aggregate/history fields are shown. Native history links target `/club/replay/[reviewId]`. Unknown profile IDs return not found; empty history and local unauthenticated status are explicit.

## Route decisions

- `/` remains the complete Practice experience.
- `/club` remains the local Club dashboard.
- `/club/replay/[reviewId]` is the native immutable replay route.
- `/club/profile/[profileId]` is the native local profile-detail route.

## Out of scope

Authenticated identity, private rooms, realtime, matchmaking, Ranked, Partners, leaderboards, tournaments, seasons, cosmetics, production deployment, monitoring, moderation, abuse prevention, anti-collusion, DDoS controls, and backup/recovery remain unimplemented.
