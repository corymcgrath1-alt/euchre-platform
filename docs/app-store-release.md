# App Store Release Guide

## Release status

Engineering has produced a bundled offline mobile client and an iOS project. A Windows
host can verify the web/mobile TypeScript, browser behavior, Capacitor configuration,
assets, and privacy files, but cannot perform Xcode simulator, device, archive,
validation, upload, TestFlight, or App Review work.

Do not call the app App Store-ready until every Mac, device, signing, metadata, privacy,
and compliance checkpoint below has actual evidence.

## Requirements verified August 7, 2026

- Apple requires uploads made since April 28, 2026 to be built with Xcode 26 or later
  using an iOS 26 SDK or later. Recheck
  [Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/)
  immediately before archiving.
- The current supported tool listing is maintained on
  [Xcode Support](https://developer.apple.com/support/xcode/).
- Apple accepts one to ten App Store screenshots without alpha. Current 6.9-inch
  portrait sizes include 1260x2736, 1290x2796, and 1320x2868. Recheck the
  [Screenshot Specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
  before capture.
- An iOS privacy policy URL and App Privacy answers are required. See
  [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy).
- Privacy manifests must be valid, and required-reason APIs must have approved reasons.
  See [Privacy Manifest Files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
  and [Third-party SDK Requirements](https://developer.apple.com/support/third-party-SDK-requirements/).

Requirements change independently of this repository. The release owner must repeat
this check for every submission.

## Owner prerequisites

1. Active Apple Developer Program membership.
2. Access to the correct App Store Connect organization with an App Manager or higher
   available for the required metadata and privacy work.
3. A permanent owned app name and bundle identifier.
4. A registered App ID matching that bundle identifier.
5. An App Store Connect app record with an owner-selected SKU and primary language.
6. A signing team, distribution certificate, and App Store provisioning capability.
7. Permanent HTTPS privacy and support URLs with a monitored support channel.
8. Owner-approved metadata, rights statements, screenshots, age-rating answers, privacy
   answers, export-compliance answers, territories, and pricing.

Never place certificates, private keys, provisioning profiles, App Store Connect API
private keys, passwords, or Team IDs in Git.

## Configure a release

1. Confirm `mobile.release.json`:
   - final `appName`;
   - permanent `bundleIdentifier`;
   - `marketingVersion`;
   - monotonically increasing `buildNumber`;
   - set `ownerConfirmationRequired` to `false` only after review.
2. The public release values default to the owned GitHub Pages and Issues URLs in
   `mobile.release.json`. Override them only when moving to another owned host:

   ```powershell
   $env:VITE_PRIVACY_POLICY_URL = "https://OWNER-DOMAIN.example/privacy"
   $env:VITE_SUPPORT_URL = "https://OWNER-DOMAIN.example/support"
   $env:VITE_SUPPORT_REQUEST_URL = "https://OWNER-DOMAIN.example/support/request"
   ```

3. Run:

   ```powershell
   npm ci
   npm run verify
   npm run mobile:e2e
   npm run ios:sync
   npm run mobile:release:check
   ```

4. Commit only configuration values that are intentionally public. Do not commit a
   local `.env`.

## Mac and physical-device verification

On a Mac with the current required Xcode/iOS SDK:

```bash
npm ci
npm run ios:sync
npm run ios:build:simulator
npm run ios:open
```

In Xcode:

1. Select the `App` target and owner signing team.
2. Confirm the bundle identifier, iPhone-only device family, iOS deployment target,
   portrait orientations, version, and build.
3. Resolve Swift packages and inspect all signing warnings.
4. Generate the Xcode privacy report and compare it with
   `docs/app-privacy-audit.md`.
5. Run on at least one physical iPhone.
6. Test first launch, offline launch, background/foreground, process termination and
   resume, share sheet, haptics, Dynamic Type, VoiceOver, Reduce Motion, and the smallest
   supported screen.
7. Verify the app contains `PrivacyInfo.xcprivacy`, the 1024x1024 opaque icon, and launch
   assets in the built bundle.

## Archive and validation

After setting owner-only inputs:

```bash
export APPLE_TEAM_ID="OWNER_TEAM_ID"
export IOS_SIGNING_IDENTITY="Apple Distribution"
export IOS_PROVISIONING_PROFILE_SPECIFIER="OWNER_PROFILE_NAME"
npm run ios:archive:check
```

Then use Xcode Organizer:

1. Select a generic iOS device destination.
2. Product > Archive.
3. Inspect size, symbols, privacy report, signing, entitlements, and embedded assets.
4. Validate App.
5. Resolve every warning or document why it is harmless.
6. Upload to App Store Connect only after explicit owner authorization.

The repository scripts never upload.

## App Store Connect

1. Wait for build processing.
2. Verify build metadata, minimum iOS version, device family, icon, version, and build.
3. Attach the build to version 1.0.
4. Enter metadata from `docs/app-store-metadata.md`.
5. Publish the permanent privacy URL and support URL.
6. Complete the current App Privacy questionnaire from the final archive and Xcode
   privacy report, including every third-party SDK.
7. Complete the current age-rating questionnaire. This is a non-gambling card game with
   no wagering, chat, user-generated content, or purchases, but the owner must choose the
   final answers.
8. Review export compliance. The app adds no custom cryptography; standard Apple/web
   transport may still trigger App Store questions. The owner must make the legal
   declaration.
9. Confirm content rights for all app icon, branding, type, card, and screenshot assets.
10. Select territories, availability, pricing, category, and release method.

## Screenshots

Capture real release builds without debug controls or placeholder warnings. Recommended
portrait sequence:

1. Active table with readable hand and legal action.
2. Bidding and trump call.
3. Trick play.
4. New Game options.
5. Completed result.
6. Mobile game review/history.

At minimum provide the current required iPhone display set; version 1.0 is iPhone-only,
so do not upload iPad screenshots. Do not imply multiplayer, Ranked, accounts, or paid
features.

Generate review-ready 6.9-inch PNGs from the actual production client with:

```bash
npm run app-store:screenshots
```

The resulting opaque 1290x2796 files are written to
`resources/app-store-screenshots/6.9-inch` and must still be reviewed against a native
release build before upload.

## TestFlight

1. Add the processed build to an internal group.
2. Complete the internal plan in `docs/testflight-test-plan.md`.
3. Resolve crashes, save corruption, accessibility blockers, or rule discrepancies
   before external testing.
4. Add beta review information and a focused external tester group only with owner
   approval.
5. Provide honest beta notes and contact information.

## Go/no-go checklist

- [ ] Xcode/SDK requirement rechecked on release day.
- [ ] Permanent name and bundle identifier confirmed.
- [ ] Clean locked install and all repository verification green.
- [ ] Unsigned simulator build green on the selected Xcode.
- [ ] Physical-device offline/resume/accessibility test green.
- [ ] Signed archive and Organizer validation green.
- [ ] Final archive privacy report audited.
- [ ] Privacy/support URLs are public and permanent.
- [ ] No placeholder warning or release configuration remains.
- [ ] App Privacy, age rating, export compliance, and content rights approved by owner.
- [ ] Current screenshots and metadata approved.
- [ ] Internal TestFlight plan passed.
- [ ] Explicit owner authorization received before upload/submission.

## Known limitations

Version 1.0 is portrait-only and iPhone-only. It has deterministic heuristic bots rather
than expert search, local-device history rather than cloud sync, no account recovery, and
no multiplayer. Local data is removed when the user resets it or removes the app. A
native Mac/Xcode/device/archive validation remains mandatory.
