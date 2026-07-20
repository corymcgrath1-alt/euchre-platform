# Game Engine

The domain engine lives in `src/lib/euchre` and is framework independent. It does not import React, browser APIs, timers, route code, or persistence code.

## Core modules

- `cards.ts`: deck identity, labels, bower/effective-suit logic, sort helpers.
- `deck.ts`: seating helpers, partner/team lookup, seeded random shuffle, deal.
- `rules.ts`: legal card play, follow-suit, trick winner, scoring, active-player helpers.
- `engine.ts`: explicit state transitions and append-only move log replay.
- `table-view.ts`: derived view models for the table and traditional score cards.
- `sim/`: invariant checks and playtest runner.

## Event sourcing

Actions such as `START_HAND`, `PASS`, `ORDER_UP`, `CALL_TRUMP`, `DISCARD`, `PLAY_CARD`, and `NEXT_HAND` are appended as move events. `replayMoveLog` reconstructs current state from ordered events.

## Multiplayer readiness

The reducer accepts commands, not state replacement. The persistence layer already uses expected sequence numbers, which is the local equivalent of an expected state version. A future server should add authenticated seat identity and idempotency keys around the same action/event model.
