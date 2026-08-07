import release from "../../../mobile.release.json";

export const APP_NAME = release.appName;
export const APP_VERSION = release.marketingVersion;
export const APP_BUILD_NUMBER = release.buildNumber;
export const TEMPORARY_BUNDLE_IDENTIFIER = release.bundleIdentifier;

export const PRIVACY_POLICY_URL =
  import.meta.env.VITE_PRIVACY_POLICY_URL?.trim() || release.privacyPolicyUrl;
export const SUPPORT_URL =
  import.meta.env.VITE_SUPPORT_URL?.trim() || release.supportUrl;
export const SUPPORT_REQUEST_URL =
  import.meta.env.VITE_SUPPORT_REQUEST_URL?.trim() || release.supportRequestUrl;

export const HAS_RELEASE_PLACEHOLDERS = [PRIVACY_POLICY_URL, SUPPORT_URL, SUPPORT_REQUEST_URL]
  .some((value) => {
    try {
      return new URL(value).hostname.endsWith(".invalid");
    } catch {
      return true;
    }
  });
