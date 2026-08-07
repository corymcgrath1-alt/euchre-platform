# Euchre Platform Engineering Guide

## Repository boundaries

- `src/lib/euchre/` is the authoritative deterministic rules engine and bot system.
- `src/lib/persistence/` owns append-only event records and replay reconstruction.
- `src/lib/review/` derives immutable reviews from completed event histories.
- `src/app/` and `src/features/` are the Next.js web application.
- `mobile/` is the phone-first Vite client. It imports shared engine and review modules; it must not copy them.
- `ios/` is generated and maintained as the Capacitor iOS shell for bundled `dist-mobile` assets.

## Source-of-truth rules

- UI state never decides legality, trick winners, scores, or bot actions.
- Persist accepted actions before displaying the resulting authoritative state.
- Reconstruct saves and reviews from ordered persisted events.
- Preserve deterministic seeded behavior and existing event compatibility.
- Never import filesystem, Supabase, Next.js, or API-route modules into the mobile bundle.

## Required commands

- `npm run verify`: typecheck, lint, unit tests, web build, and mobile build.
- `npm run mobile:test`: browser event-store and mobile orchestration tests.
- `npm run mobile:e2e`: phone-width, offline, persistence, and accessibility browser checks.
- `npm run ios:sync`: rebuild mobile assets and sync the native project.
- `npm run ios:build:simulator`: unsigned iPhone simulator build on macOS.
- `npm run ios:archive:check`: non-uploading archive readiness check; requires macOS, Xcode, and signing inputs.

## Test expectations

- Run existing engine tests after any shared-module change.
- Cover persistence migrations, corrupt records, sequence conflicts, resume, and replay.
- Exercise 320, 390, and 430 CSS-pixel phone widths without document overflow.
- Core solo gameplay tests must make no public-network request.

## Mobile release constraints

- Capacitor must load bundled assets only; never configure a production `server.url`.
- Release builds must contain no localhost URL, live reload, fake queue, real-user mocks, or debug game dumps.
- Keep iPhone version 1 portrait-only until landscape is separately validated.
- No analytics, ads, tracking, account, remote game-logic, or unnecessary permission SDKs.

## Secrets

Never commit Apple certificates, private keys, provisioning profiles, App Store Connect keys, Team IDs, service-role keys, or production credentials. Use documented environment placeholders for owner-supplied signing and store metadata.
