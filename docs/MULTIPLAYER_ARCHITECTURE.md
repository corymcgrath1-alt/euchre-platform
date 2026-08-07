# Multiplayer Architecture

Future multiplayer should be server authoritative.

## Command flow

1. Client submits a command with match ID, authenticated seat identity, expected state version, and idempotency key.
2. Server verifies identity, seat ownership, turn, phase, and legality.
3. Server persists accepted events transactionally.
4. Server broadcasts filtered projections to each client.
5. Reconnect reconstructs state from events plus optional snapshots.

## Persistence model

Future PostgreSQL tables should include users, profiles, matches, match seats, hands, commands, events, snapshots, replay visibility, rating accounts, rating ledger, seasons, tournaments, deck ownership, and equipped deck.

## Anti-cheat boundaries

Clients submit commands, never state. Hidden cards must not appear in another seat's projection. Rating updates occur only after one valid terminal match transaction.
