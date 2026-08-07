# Rating System

The rating foundation is implemented in `src/lib/rating/glicko2.ts` and is not activated for Practice games.

## Accounts

Ratings are separated by queue:

- `solo-queue`
- `fixed-partners`
- `tournament-seeding`

Published rating is separate from internal deviation and volatility. UI may display rating and division, but rating deviation and volatility should remain internal.

## Updates

`rateTeamMatch` estimates each team's strength from both player accounts, updates each player against the opposing team strength, and emits append-only ledger entries. Practice games must not call this module.

Ledger entries include match ID, queue, player/team IDs, result, before/after rating, before/after deviation, before/after volatility, opposing team strength, algorithm version, timestamp, and idempotency key.

## Safety

The module rejects duplicate players and queue mismatches. Existing ledger entries prevent repeated updates for the same idempotency key or the same player/match/queue combination.
