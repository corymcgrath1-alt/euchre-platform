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

`PracticeClient` remains the trusted local Practice orchestrator. It owns canonical state so it can submit Platform commands, schedule deterministic bots, and resume the append-only local game. Its child modules receive `ClubTableView`, replay/profile projections, explicit primitives, and narrow callbacks only. No child receives `GameState`, all seat hands, kitty contents, or a dealer discard.

This local controller model is not a multiplayer security architecture. Future rooms must move command authority behind authenticated server-side actor and seat derivation before any remote opponent is introduced.
