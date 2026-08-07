# Mobile Architecture

## Status

Euchre Club 1.0 is an offline-first solo client built in the same repository as the
Next.js web application. The mobile client is implemented with Vite, React, IndexedDB,
and Capacitor 8. It imports the existing deterministic Euchre engine and review
projections directly. It does not require the Next.js server, an API route, Supabase,
an account, or a network connection for core play.

This architecture was selected to preserve one rules implementation while giving iPhone
play a phone-first interface and a native application lifecycle.

## Source-of-truth boundaries

| Concern | Authoritative module |
| --- | --- |
| Dealing, bidding, legal actions, bowers, tricks, scoring | `src/lib/euchre/` |
| Deterministic bot choices | `src/lib/euchre/bots/` |
| Event types and replay reconstruction | `src/lib/persistence/types.ts`, `src/lib/persistence/replay.ts` |
| Review truth | `src/lib/review/` |
| Web server persistence | `src/lib/persistence/local-event-store.ts`, optional Supabase adapter |
| Mobile persistence | `mobile/src/persistence/mobile-event-store.ts` |
| Mobile orchestration | `mobile/src/game/solo-game-service.ts` |
| Mobile rendering and native integration | `mobile/src/`, `ios/` |

The mobile UI never computes legal moves, trick winners, scores, or bot actions. It
renders `ClubTableView`, submits one engine action, and displays state only after that
accepted action has been atomically appended.

## Runtime data flow

```text
Human tap or deterministic bot decision
  -> legal GameAction from the shared engine
  -> MobileEventStore.appendMove
  -> expected sequence and reducer validation
  -> one IndexedDB transaction writes event + game projection
  -> reload ordered events
  -> reconstructGameState
  -> buildClubTableView for South
  -> render accepted state
```

Bot scheduling is presentation pacing only. App backgrounding cancels pending timers.
On resume, the service reloads the ordered event history and schedules the next bot
action only if the reconstructed state still assigns that turn to a bot. The expected
sequence and unique `(gameId, sequence)` key prevent duplicate accepted moves.

## Offline persistence

`MobileEventStore` uses IndexedDB through `idb` with versioned object stores for:

- game records and persisted game config;
- append-only move events;
- the active-game pointer;
- mobile settings;
- completed-game history derived from terminal games.

Schema upgrades run in the IndexedDB upgrade transaction. Persisted records are parsed
with runtime schemas. Corrupt or partial records fail with a bounded local error rather
than being reduced as game truth. Reviews and resumes are reconstructed from ordered
events. The development test suite can clear its isolated database, while the production
UI exposes only confirmed user-facing reset and history-delete flows.

## Client structure

```text
mobile/
  index.html
  src/
    App.tsx                    screen controller and lifecycle
    game/solo-game-service.ts authoritative orchestration
    persistence/              asynchronous event store
    native/                   Capacitor adapters
    screens/                  phone-first screens
    components/               reusable accessible controls
    styles/                   safe-area-aware visual system
ios/
  App/                        Capacitor Xcode project
```

Required screens are Home, New Game, Active Table, Hand Result, Game Result, History,
Review, Settings, How to Play, Privacy, and Support. The active table prioritizes the
score, phase, seats, trick, South hand, and legal actions. Secondary history and rules
information lives on separate screens.

## Native boundary

Capacitor loads `dist-mobile` from the app bundle. `capacitor.config.ts` intentionally
has no `server` block or `server.url`. The native shell uses only:

- `@capacitor/app` for active/background lifecycle;
- `@capacitor/haptics` for optional tactile feedback;
- `@capacitor/share` for a user-initiated result share sheet;
- `@capacitor/splash-screen` and `@capacitor/status-bar` for shell presentation.

The app requests no location, contacts, camera, microphone, photo, Bluetooth,
notification, tracking, or background-mode entitlement.

## Release configuration

`mobile.release.json` is the single checked-in source for display name, temporary bundle
identifier, marketing version, and build number. The bundle identifier
`com.corymcgrath.euchreclub` remains explicitly owner-confirmation-required.

`VITE_PRIVACY_POLICY_URL`, `VITE_SUPPORT_URL`, and `VITE_SUPPORT_EMAIL` are public
browser values. Placeholder values produce a visible in-app warning and must be replaced
before App Review. Apple signing values are never `VITE_` variables and are not bundled.

`npm run mobile:release:check` rejects release assets containing local/live-reload URLs,
Next.js API dependencies, server persistence, mock multiplayer language, or debug game
logging. It also requires a visible warning while release URL placeholders remain.

## Network behavior

Core gameplay makes no application network request. Vite assets are bundled into the
iOS application. User-initiated external privacy/support links and the destinations a
user selects in the native share sheet are outside core gameplay. The web application
and optional Supabase adapter remain separate and are not imported by the mobile bundle.

## Build workflow

```powershell
npm ci
npm run mobile:test
npm run mobile:build
npm run mobile:e2e
npm run ios:sync
```

On a supported Mac:

```bash
npm run ios:build:simulator
npm run ios:open
```

An App Store archive additionally requires the owner-confirmed bundle identifier,
Apple Developer Team ID, permanent privacy/support URLs, signing identity, and a current
Xcode installation. `npm run ios:archive:check` reports missing prerequisites and never
uploads an archive.

## Explicit exclusions

Version 1.0 has no human multiplayer, matchmaking, Ranked mode, accounts, chat,
tournaments, clubs, ads, tracking, payments, subscriptions, remote game logic, or paid
cosmetics. The existing optional web/Supabase code is not part of the native offline
runtime.
