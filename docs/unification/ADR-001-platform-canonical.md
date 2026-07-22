# ADR-001: Platform Is The Canonical Euchre Runtime

## Status

Accepted for the first unification slice.

## Context

`euchre-platform` and `club-euchre-rank` describe related products but have different ownership boundaries. Platform contains the deterministic Euchre engine, legal-action API, append-only move history, persistence adapters, bots, simulations, reviews, profile projections, and rating foundation. Club contains a stronger product identity and route vocabulary, plus a separately audited Ranked branch with useful service patterns.

Club's default branch also contains presentation-domain game types and fictional ratings, matches, leaderboards, tournaments, and profiles. Its TanStack Start runtime and those mock models are not authoritative game or product data.

## Decision

Platform remains the only repository and Next.js runtime for the unified product.

- No Git merge, subtree, monorepo, or cross-repository runtime dependency will be used.
- Club is a design, interaction, and competitive-service reference.
- Migrated UI becomes native Platform code using Platform types and conventions.
- Platform `GameState`, legal actions, move events, reviews, and profile projections remain authoritative.
- Club-facing components consume pure presentation adapters over Platform projections.
- Incomplete competitive routes remain disabled or explicitly labeled as future work.
- The audited Club Ranked service is not deployed or live and will not be copied as a second rules engine.

## Presentation Boundary

Presentation adapters may rename, format, sort, orient seats, select viewer-visible fields, and derive labels from authoritative values. They may not calculate legality, winners, scores, ratings, state transitions, or replay facts. They may not expose hidden cards or invent unavailable product data.

## Consequences

The first slice can adopt Club's ink, ivory, brass, felt, and oxblood identity without changing gameplay. Future multiplayer must wrap Platform commands and event persistence with authentication, seat ownership, concurrency, idempotency, and viewer filtering instead of synchronizing React state.
