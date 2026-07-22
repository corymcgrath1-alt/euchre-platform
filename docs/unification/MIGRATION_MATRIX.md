# Euchre Unification Migration Matrix

The source comparison covers Club `main` at `78b4b256`, Practice at `875f6adf`, and Ranked at `56184968`. Ranked had green disposable-Supabase verification but no hosted development deployment.

| Capability | Platform implementation | Club implementation | Unified decision | Migration method |
| --- | --- | --- | --- | --- |
| Rules and scoring | Complete deterministic engine and strict invariants | Default branch uses presentation models; later branches copy Platform engine | Superseded by Platform | Keep Platform unchanged; reject copied engine |
| Legal actions | `legalActionsForPlayer` and reducer validation | Mock UI originally treats demo state as playable; Practice branch uses copied engine | Superseded by Platform | Adapt Platform legal projections only |
| Game state | Typed `GameState` reconstructed from move events | `GameStateView` is a UI model; Ranked adds private canonical state | Superseded by Platform | Keep Platform state; add pure view adapters |
| Bots | Deterministic easy/standard/strong and versioned policies | Practice branch ports Platform bots | Superseded by Platform | Keep Platform bots and seeds |
| Persistence | Local filesystem and Supabase event stores with expected sequence | Practice browser store; Ranked private canonical tables | Platform remains canonical | Preserve append-only store; later harden server transaction boundary |
| Replays | Reviews and replay selection derived from immutable events | Stronger replay route and controls in Practice branch | Adapt and rewrite | Native Next.js replay route over Platform `GameReview` |
| Profiles | Completed-game review aggregates and detail projections | Default branch uses fictional identity/rating/history | Platform truth with Club presentation | Map real Platform aggregates; explicit local/empty state |
| Table UI | Functional table-first single-player page | Stronger felt/brass/oxblood composition and responsive hierarchy | Adapt and rewrite | Native components consuming Platform table projections |
| Navigation | Single route | Strong route vocabulary and application shell | Port visual concept | Compact native Next.js shell; only real routes are links |
| Practice | Complete persisted match against deterministic bots | Real in Practice branch; fake in default demo | Superseded by Platform | Preserve Platform behavior and restyle incrementally |
| Private tables | Not implemented | Product concept only | Requires later service | Disabled until authenticated room/event service exists |
| Ranked Solo | Rating foundation only | Audited server-authoritative local vertical slice | Preserve as service requirement | Adapt transaction/security patterns later; disabled by default |
| Fixed partners | Queue type in rating foundation | Preview/product concept | Requires later service | Defer until rooms and Ranked Solo are proven |
| Matchmaking | Not implemented | First-available queue with row locks on Ranked branch | Adapt later | Use reservations and `FOR UPDATE SKIP LOCKED` around Platform event flow |
| Ratings | Pure `glicko2-team-v1`, disconnected from Practice | Atomic four-account Ranked transaction | Platform calculation; adapt transaction pattern | One terminal match record and idempotent ledger transaction |
| Leaderboards | Not implemented | Fictional preview rows | Preserve only as requirement | Disabled preview; never expose mock rows as real |
| Tournaments | Not implemented | Fictional brackets/registration | Preserve only as requirement | Defer to tournament service after Ranked |
| Decks and cosmetics | Standard readable cards | Broad visual catalog and ownership concepts | Adapt later | Migrate catalog metadata only after ownership/storage exists |
| Tests | 238 engine/API/store/replay/profile tests plus simulations | Browser and disposable-Supabase coverage on feature branches | Combine patterns, not runtimes | Add native adapter/UI tests; later add Next.js browser CI |
| Deployment | Next.js production build; optional Supabase event store | TanStack/Nitro and guarded Supabase scripts | Platform-only deployment | Do not import TanStack/Vite/Nitro configuration |
| Security | Command/event boundary documented; local API is not authenticated | Ranked JWT, RLS, private Realtime, redaction, CORS gates | Adapt later | Preserve patterns in multiplayer ADR; no current live claim |
| Observability | Not yet structured | Ranked redacted request/version/result logs | Adapt later | Add at authoritative multiplayer boundary, excluding private cards/secrets |

## Club Code Rejected From Migration

- `src/lib/euchre/mock.ts` fictional players, ratings, match history, tournaments, leaderboards, and activity.
- Default demo state and scripted timers as a production game path.
- Presentation types that could become a second `GameState` or legal-action model.
- Any UI calculation of trick winners, hand scores, game results, ratings, or profile truth.
- Client-supplied identity, seat, team, score, result, seed, or canonical state.
- Hidden-hand serialization followed by opportunistic field deletion.
- Matchmaking without transactional reservation and expected-version controls.

## Ranked Pattern Audit

Potentially reusable patterns are verified JWT actor derivation, strict intent schemas, SHA-256 idempotency hashes, direct transaction handling with prepared statements disabled, deterministic queue order with `FOR UPDATE SKIP LOCKED`, one-player reservations, match-row locks, stable rating-account lock order, post-commit version-only Realtime notifications, explicit player views, fail-closed CORS/environment gates, and redacted structured logs.

The Club Ranked implementation remains a reference only. Its copied engine, TanStack client/runtime, Supabase schema, and Edge Function are not migrated in this slice. Hosted development verification was not completed, so it is not evidence of live or private-alpha readiness.
