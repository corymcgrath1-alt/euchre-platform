# App Privacy Audit

## Scope and status

This source-level audit covers the iOS mobile client as implemented on August 7, 2026.
The proposed App Store answers are not legal advice and are not final declarations.
Before every upload, the owner must audit the final archive, Xcode privacy report,
dependency lockfile, network behavior, and App Store questionnaire.

## Persisted data

| Data | Location | Leaves device during normal play | Linked to identity | Tracking |
| --- | --- | --- | --- | --- |
| Game configuration and practice seed | IndexedDB app storage | No | No account exists | No |
| Ordered move events | IndexedDB app storage | No | No account exists | No |
| Active-game recovery pointer | IndexedDB app storage | No | No account exists | No |
| Completed-game history and reviews | IndexedDB app storage | No | No account exists | No |
| Haptic, animation, confirmation, auto-deal settings | IndexedDB app storage | No | No account exists | No |
| User-composed share result | iOS share sheet after user action | User chooses destination | Depends on destination, not app | Not by app |

Reset Local Data removes the app's IndexedDB records after confirmation. App removal
removes app-container data according to iOS behavior.

## Native dependencies

| Dependency | Version | Purpose | Permission/data assessment |
| --- | --- | --- | --- |
| Capacitor core/iOS | 8.4.2 | Native web runtime and bridge | No app-declared collection; final signed SDK/privacy report required |
| `@capacitor/app` | 8.1.1 | Active/background lifecycle | Receives lifecycle state; no account or analytics |
| `@capacitor/haptics` | 8.0.2 | Optional tactile feedback | No persisted personal data |
| `@capacitor/share` | 8.0.1 | User-initiated native share sheet | User controls destination |
| `@capacitor/splash-screen` | 8.0.2 | Launch presentation | No data |
| `@capacitor/status-bar` | 8.0.3 | Status-bar presentation | No data |

Runtime JavaScript dependencies used in the bundle include React, Zod, `idb`, and the
project-owned engine/review code. The Supabase client and Next.js runtime are not in the
mobile import graph or release bundle.

Apple lists Capacitor among SDKs subject to third-party SDK privacy manifest/signature
requirements. Xcode must validate the final resolved Capacitor SDK and produce an
aggregate privacy report before submission:
[Third-party SDK Requirements](https://developer.apple.com/support/third-party-SDK-requirements/).
The installed Capacitor 8.4.2 iOS source includes `PrivacyInfo.xcprivacy` resources for
both Capacitor and CapacitorCordova, each declaring no tracking, collection, domains, or
required-reason API categories. The five selected plugin packages contain no additional
manifest in the installed source and no source reference to the covered disk-space,
system-uptime, or UserDefaults API categories was found in the plugin implementations.
This source audit does not replace Xcode's final SDK signature and privacy-report checks.

## Network inventory

Core launch, new game, bidding, bot turns, play, scoring, save/resume, history, and review
load bundled assets and local IndexedDB only. They do not call a Next.js route, Supabase,
or another application server.

Network-capable user actions:

- opening the configured privacy policy URL in the browser;
- opening the configured support URL;
- sending email through a system handler;
- sharing result text to a user-selected iOS destination.

No analytics, advertising, crash-reporting, push-notification, remote configuration,
tracking, or fingerprinting endpoint is configured. Browser and destination providers
may process standard request/share metadata under their own policies after the user
chooses those actions.

## Permissions and capabilities

`Info.plist` contains no usage descriptions for location, contacts, camera, microphone,
photos, Bluetooth, notifications, motion, health, or local network. No custom entitlement
or background mode is configured. Version 1.0 is iPhone-only and portrait-only.

## Privacy manifest

`ios/App/App/PrivacyInfo.xcprivacy` is part of the application target resources and
currently declares:

- tracking: false;
- tracking domains: none;
- collected data types: none;
- app-authored required-reason API categories: none.

This is correct only if the final Xcode privacy report confirms those facts. Apple rejects
invalid manifests and requires approved reasons for covered APIs. See
[Privacy Manifest Files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
and [Required Reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api).

## Proposed App Store privacy answers

Based on this implementation and subject to final-archive verification:

- **Does this app or its third-party partners collect data?** Proposed: No.
- **Data linked to the user:** None.
- **Data used to track the user:** None.
- **Tracking permission request:** Not used.
- **Privacy policy URL:** Required; owner must publish the final URL.
- **Privacy choices URL:** Optional; local deletion instructions are in the app and
  public policy.

Apple defines collection around off-device transmission retained beyond servicing the
request, and requires declarations to include third-party partners. The owner must compare
these proposed answers with the final archive and current
[App Privacy guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy).

## Export compliance

The application adds no custom cryptographic implementation. It can open ordinary HTTPS
privacy/support links and uses Apple platform/framework behavior bundled through
Capacitor. The owner must answer App Store Connect export-compliance questions based on
the final binary, distribution territories, and legal advice. No exemption is asserted
by this document.

## Required release audit

1. Run clean locked install and record exact package versions.
2. Build and archive with the current required Xcode and iOS SDK.
3. Generate Xcode's aggregate privacy report.
4. Inspect all embedded frameworks, manifests, signatures, entitlements, and Info.plist
   permission strings.
5. Run the app through a network-observation proxy while exercising every screen,
   background/resume, external link, and share flow.
6. Confirm no gameplay payload, seed, hand, event history, or setting is transmitted.
7. Reconcile findings with App Store privacy answers and the published policy.
8. Have the owner approve the final declarations.
