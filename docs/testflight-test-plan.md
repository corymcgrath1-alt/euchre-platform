# TestFlight Test Plan

## Purpose

This plan validates the signed iOS build after repository, simulator, and physical-device
checks are available. TestFlight is not a substitute for deterministic engine tests or
the local browser suite.

## Entry criteria

- All commands in `npm run verify` pass from a clean locked install.
- Mobile Playwright passes at 320, 390, and 430 CSS-pixel widths.
- Current Xcode/iOS SDK requirement has been rechecked.
- Unsigned simulator build passes.
- Signed archive validates in Xcode Organizer.
- Permanent bundle identifier, privacy URL, support URL, and contact are configured.
- Xcode privacy report has been reconciled with `docs/app-privacy-audit.md`.
- App Store Connect build has no unresolved processing warning.

## Devices and accessibility

Use at least:

- the smallest supported iPhone or equivalent simulator;
- a current 6.1/6.3-inch iPhone;
- a current 6.9-inch iPhone;
- one physical device on the oldest supported iOS;
- one physical device on the current iOS.

Repeat critical paths with VoiceOver, larger Dynamic Type, Increase Contrast where
applicable, Reduce Motion, and device offline mode.

## Core test cases

### Install and launch

1. Clean-install the build.
2. Confirm original icon, launch screen, correct name, portrait orientation, and matching
   status-bar appearance.
3. Launch in airplane mode.
4. Verify Home renders without a server or login.
5. Confirm no unavailable competitive feature is advertised.

### Complete solo game

1. Start with target score 5 and Standard bots.
2. Exercise first-round order-up and second-round trump calling.
3. Exercise dealer pickup/discard when South deals.
4. Verify the left bower is presented as trump and follow-suit controls remain legal.
5. Exercise a lone call; verify the partner sits out and lone tricks contain three cards.
6. Verify normal tricks contain four cards and the winner leads.
7. Complete the game and compare result/review truth.
8. Open the native share sheet and cancel without sending.

Repeat a seeded game on Easy and Strong. Record seed and final score so the result can be
compared with deterministic browser/engine output.

### Persistence and lifecycle

1. Begin a game and background on a human turn.
2. Return and verify identical hand, phase, score, and move sequence.
3. Background during the delay before a bot turn.
4. Force-quit, reopen, and Resume Game.
5. Verify exactly one bot action occurred after resume.
6. Reboot the device and verify the active game still reconstructs.
7. Complete the game and verify it moves to history.
8. Remove/reinstall only after confirming the expected local-data-loss behavior.

### Offline behavior

1. Disable Wi-Fi and cellular access before launch.
2. Start, play, background, resume, complete, and review a game.
3. Confirm no required network error or blocked state.
4. Confirm external privacy/support links fail honestly while offline without affecting
   saved gameplay.

### Settings and destructive controls

1. Toggle haptics, each animation level, card confirmation, and auto-deal.
2. Verify settings persist after termination.
3. Verify reduced animation honors both app setting and iOS Reduce Motion.
4. Confirm history deletion does not delete an active game.
5. Confirm Reset Local Data requires destructive confirmation and clears local data.

### Accessibility and layout

1. Navigate essential actions with VoiceOver.
2. Verify cards announce rank/suit and legal/disabled state.
3. Verify score, dealer, trump, current turn/winner, and buttons have meaningful names.
4. Use large Dynamic Type and verify essential controls remain reachable.
5. Check safe-area spacing around the notch/Dynamic Island and home indicator.
6. Verify no horizontal page scroll or blocked bottom action at each target device.
7. Confirm visible focus when a hardware keyboard is connected.

## Review/history validation

1. Open the completed game from History.
2. Step through each hand and trick.
3. Verify final score, maker, trump, trick winners, and game winner match the played game.
4. Confirm history date, outcome, difficulty, and rules.
5. Confirm New Game does not erase completed history.

## Diagnostics

For every failure, record:

- TestFlight build/version;
- iPhone model and iOS version;
- practice seed, phase, and score;
- steps immediately before failure;
- whether the app had backgrounded;
- screenshot or screen recording without private device data;
- reproducibility after relaunch.

Do not request full device identifiers or unrelated personal information. Do not log or
upload complete game records through a release-only diagnostic path.

## Exit criteria

- No crash, data-loss, illegal-action, scoring, replay, or duplicate-bot defect remains.
- All target devices complete an offline game.
- Active-game termination/resume succeeds.
- Accessibility blockers are resolved.
- Share/haptic/lifecycle integrations pass on physical hardware.
- Privacy/support links and metadata are final.
- Owner approves the go/no-go checklist and explicitly authorizes any upload/submission.
