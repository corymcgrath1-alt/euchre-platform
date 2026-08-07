# Verification

## Commands run

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run simulate -- --games 10000 --seed 20260720
npm run playtest -- --games 10000 --seed 20260720 --bot-policy intermediate-v1 --invariants strict --out playtest-results/run-20260720-10000-lone-sitout
```

## 10,000-game simulator result

- Games: 10000
- Hands: 117623
- Average hands per game: 11.7623
- Team 0 wins: 5107 (51.1%)
- Team 1 wins: 4893 (48.9%)
- Maker success/euchre: 77.8% / 22.2%
- Dealer pickup: 95.8%
- Lone attempts/success: 13.7% / 19.1%
- Marches/euchres: 9.8% / 22.2%
- Illegal moves / failed games: 0 / 0

## 10,000-game strict playtest result

- Games: 10000
- Completed: 10000
- Failed: 0
- Hands: 120404
- Average hands per game: 12.0404
- Team 0 wins: 5141 (51.4%)
- Team 1 wins: 4859 (48.6%)
- Maker win/euchre: 83.4% / 16.6%
- Round 1 / Round 2 calls: 81.1% / 18.9%
- Lone attempts: 13297
- Lone successes: 3804

The remaining invariant warning class is `discard-card-not-retained`, because dealer pickup discards are represented in the append-only event log rather than retained in current state.
