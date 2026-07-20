# Codex Takeover Audit

## Repositories inspected

- `b2ad5484-44e2-498e-b6c1-c0d90498e54d` Lovable project: read access only in this session. The connector returned `403 insufficient_scope` for edits because `projects:write` is required.
- `C:\Users\Surface i7\Documents\Euchre\euchre-platform`: incomplete local checkout, no commits in parent worktree. It contains early engine code but is missing modules referenced by tests.
- `corymcgrath1-alt/euchre-platform`: complete GitHub repository cloned into this workspace as `github-euchre-platform`.

## What was real before

- Pure TypeScript Euchre rules engine.
- Seeded shuffling and deterministic replay from move events.
- Local persisted game/event store with API routes.
- Practice-oriented single-player UI.
- Bot policies: `basic-v1`, `legal-random-v1`, and `intermediate-v1`.
- Review, replay, profile aggregate helpers derived from event history.
- Traditional two-five-card score view models.
- Headless simulator and strict playtest runner.

## What was mocked or incomplete before

- The Lovable app was still a product prototype with scripted `/table/demo`, fake ranked queue timing, fake rating deltas, and demo leaderboards/tournaments/replays.
- The complete engine scored lone calls but still modeled every trick as four cards. Partner sit-out was only recorded as an invariant warning.
- Rating foundation was deferred.
- The current Lovable project could not be modified from this session because write scope was unavailable.

## Changes in this branch

- Lone hands now skip the caller's partner in turn order.
- Lone tricks complete after three active players.
- Invariant checks now validate three-card lone tricks instead of warning that sit-out is unmodeled.
- Table and animation view helpers no longer assume every completed trick has four cards.
- Added a pure Glicko-2 team rating foundation with append-only ledger entries and idempotency protection.
- Added focused tests for lone sit-out and rating behavior.

## Boundary

This branch does not claim to have updated the live Lovable app. The Lovable project must be granted write scope or mirrored to a writable Git repository before the hardened engine can be ported into the current public prototype.
