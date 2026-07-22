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

- Table: Platform table projections plus the authoritative legal-action summary.
- Replay: `GameReview` rebuilt from persisted move events.
- Profile: `ProfileAggregateSummary` and `PlayerProfileDetail` rebuilt from completed reviews.
- Future lobby: a viewer-authorized server projection, not client room state.

Tests must prove deterministic output, source immutability, legal-card pass-through, hidden-card exclusion, stable orientation, and exact dealer/maker/trump/loner mapping.

