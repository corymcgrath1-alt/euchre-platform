# Native Platform Unification Roadmap

## Route Order

1. `/club`: real local profile dashboard and compact Club shell.
2. `/`: existing authoritative Practice table, incrementally restyled.
3. `/replays/[gameId]`: immutable review-backed replay.
4. `/profile/[seat]`: real aggregate detail.
5. `/rooms/*`: authenticated private rooms and invites.
6. `/ranked/*`: server-authoritative Ranked Solo behind fail-closed gates.
7. Fixed Partners, leaderboards/seasons, tournaments, then cosmetics.

Unimplemented routes are disabled navigation labels or honest specification pages. They must not use Club mock data.

## Multiplayer Service Roadmap

The service must add authenticated actors, server-derived seats, room membership, strict client intents, expected event sequence, idempotency keys, one transaction for validation and event persistence, viewer-filtered projections, version-only invalidation notifications, reconnect from persisted events, trusted deadlines, abandonment/forfeit policy, exactly-once terminal ratings, and redacted structured logs.

Useful Club Ranked patterns may be rewritten around Platform's event store: player reservations, deterministic `FOR UPDATE SKIP LOCKED` queue claims, per-match locks, stable account lock order, private Realtime authorization, polling fallback, fail-closed CORS, and environment allowlists. Ranked stays disabled until an isolated hosted development environment passes four-client verification.

## Security And Feature Gates

- Browsers never submit another identity, seat, legal list, score, winner, rating, or terminal result.
- Hidden cards are constructed out of viewer projections, not removed after serialization.
- Service credentials are server-only and logs exclude tokens, connection strings, hands, deck order, kitty, and hidden discard.
- Practice remains available without multiplayer credentials and cannot write Ranked ratings.
- Private, Ranked, Partners, leaderboards, tournaments, and ownership features default to disabled.

## Reviewable Work Packages

### WP1: Shell And Club Dashboard

Acceptance: compact responsive navigation, real completed-game profile metrics, loading/empty/error/local-session states, keyboard focus, reduced motion, no fictional values. Tests cover navigation and profile mapping.

### WP2: Practice Route Boundary

Acceptance: move the existing client implementation behind a feature component with no command, projection, persistence, bot, replay, or profile behavior change. Existing 238 tests, build, simulations, and strict playtest remain green.

### WP3: Club Table Components

Acceptance: split setup, seats, scores, trick, hand, bidding, status, and persistence feedback into components consuming Platform projections. Snapshot command transcripts before and after; test legal controls and hidden cards.

### WP4: Native Replay And Profile Routes

Acceptance: routes use immutable event reviews and real aggregates, support deterministic navigation and honest empty/error states, and contain no analysis or mock match data.

### WP5: Authenticated Private Rooms

Acceptance: server-derived identity/seat, atomic expected-sequence command persistence, idempotent retry, reconnect, viewer filtering, and disposable-database authorization tests.

### WP6: Ranked Solo Development Slice

Acceptance: secure server deals, queue reservations, row/match locks, timeouts/forfeits, exactly four atomic rating entries, private Realtime invalidation, four-client hosted development verification, and default-disabled production gates.

### WP7+: Competition And Cosmetics

Leaderboards/seasons derive from rated ledgers; tournaments derive from authoritative matches; decks require real ownership/equipment records. No route launches on preview data.
