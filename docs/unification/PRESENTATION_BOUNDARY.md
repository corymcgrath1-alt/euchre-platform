# Club Presentation Boundary

## Allowed Adapter Work

Adapters are pure deterministic functions. They may:

- map real profile aggregates into metric labels;
- orient immutable seats relative to the viewer;
- select the viewer's hand and public card counts;
- carry through engine-supplied legal card IDs and bidding options;
- format dealer, maker, trump, loner, score, phase, and turn labels;
- map immutable review hands and tricks into replay navigation rows;
- sort display collections without mutating source values.

## Prohibited Adapter Work

Adapters may not:

- call a reducer or advance a game;
- infer a legal bid or playable card;
- determine a trick winner or score a hand;
- synthesize a match result or rating;
- expose opponent hands, kitty cards, or hidden discards;
- invent a player identity, rank, record, history, ownership, or competition result;
- mutate Platform engine, review, or profile input.

## Source Contracts

- Table: `buildClubTableView(GameState, viewerSeat)` is the sole raw-state adapter. It clones visible cards, carries legality from `legalActionsForPlayer`, exposes only opponent card counts, and removes deal seeds and private discard or replacement identities.
- Replay: persisted move events are cloned, ordered, and reduced through `applyMoveEvent`; each resulting state passes through `buildClubTableView`. Server routes select one viewer-safe step before serializing props to the client replay controls.
- Profile: `ProfileAggregateSummary` and `PlayerProfileDetail` rebuilt from completed reviews.
- Future lobby: a viewer-authorized server projection, not client room state.

Tests must prove deterministic output, source immutability, legal-card pass-through, hidden-card exclusion, stable orientation, and exact dealer/maker/trump/loner mapping.

## Practice Controller Boundary

`PracticeClient` owns only the current `ClubTableView`, event count, local settings, and narrow command callbacks. `/api/games/[gameId]/practice` loads canonical persisted state on the server, derives bot actions there, appends through the Platform event store, and returns a viewer-safe projection. The client no longer receives active `GameState`, all seat hands, kitty contents, a dealer discard, or a deal seed through its normal Practice path.

The endpoint is local and unauthenticated, so it is still not a multiplayer security architecture. Future rooms must add authenticated server-side actor and seat derivation before any remote opponent is introduced.
