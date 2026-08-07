# Bot Policies

## Policies

- `basic-v1`: deterministic heuristic policy retained from the initial single-player implementation.
- `legal-random-v1`: seeded random selection from legal actions. This is useful for stress testing rules and simulations.
- `intermediate-v1`: deterministic heuristic policy using hand strength, position, next-suit pressure, discard value, trick control, and conservative lone thresholds.

## Information boundary

Bot decisions are routed through legal action helpers and the active game state. The policy surface should continue moving toward filtered seat projections before multiplayer, so no bot code can accidentally depend on hidden opponent or partner cards.

## Playtesting

Run strict bot-vs-bot tests with:

```powershell
npm run playtest -- --games 10000 --seed 20260720 --bot-policy intermediate-v1 --invariants strict --out playtest-results/run-20260720-10000
```
