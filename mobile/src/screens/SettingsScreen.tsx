import { useState } from "react";
import type { MobileSettings } from "../persistence/mobile-event-store";
import {
  APP_BUILD_NUMBER,
  APP_VERSION,
  HAS_RELEASE_PLACEHOLDERS,
  TEMPORARY_BUNDLE_IDENTIFIER
} from "../config/release";
import { BottomNavigation, ConfirmDialog, ScreenHeader } from "../components/mobile-ui";

export function SettingsScreen({
  settings,
  busy,
  onChange,
  onReset,
  onNavigate
}: {
  readonly settings: MobileSettings;
  readonly busy: boolean;
  readonly onChange: (settings: MobileSettings) => void;
  readonly onReset: () => void;
  readonly onNavigate: (screen: "home" | "history" | "settings") => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <main className="app-screen settings-screen" data-testid="settings-screen">
      <ScreenHeader title="Settings" eyebrow="This device" />
      <section className="settings-group" aria-labelledby="play-settings-heading">
        <h2 id="play-settings-heading">Play</h2>
        <Toggle
          label="Haptics"
          description="Feel card plays and major results on supported devices."
          checked={settings.haptics}
          onChange={(checked) => onChange({ ...settings, haptics: checked })}
        />
        <label>
          <span>
            <strong>Animation level</strong>
            <small>Reduced motion also follows the iPhone system setting.</small>
          </span>
          <select
            value={settings.animationLevel}
            onChange={(event) => onChange({
              ...settings,
              animationLevel: event.target.value as MobileSettings["animationLevel"]
            })}
          >
            <option value="full">Full</option>
            <option value="reduced">Reduced</option>
            <option value="none">None</option>
          </select>
        </label>
        <Toggle
          label="Confirm card before play"
          description="Ask before committing each play or discard."
          checked={settings.confirmCardPlay}
          onChange={(checked) => onChange({ ...settings, confirmCardPlay: checked })}
        />
        <Toggle
          label="Auto-deal next hand"
          description="Continue after the hand-result pause."
          checked={settings.autoDealNextHand}
          onChange={(checked) => onChange({ ...settings, autoDealNextHand: checked })}
        />
      </section>
      <section className="settings-group" aria-labelledby="storage-heading">
        <h2 id="storage-heading">Local data</h2>
        <p>Games, reviews, and settings stay in this app&apos;s local storage.</p>
        <button className="button button--danger" type="button" onClick={() => setConfirmReset(true)}>
          Reset Local Data
        </button>
      </section>
      <section className="app-about" aria-label="App information">
        <p>Euchre Club {APP_VERSION} ({APP_BUILD_NUMBER})</p>
        <p className="monospace">{TEMPORARY_BUNDLE_IDENTIFIER}</p>
        {HAS_RELEASE_PLACEHOLDERS ? (
          <p className="release-warning" data-release-placeholder-warning>
            Release warning: the owner must replace privacy and support placeholders before App Review.
          </p>
        ) : null}
      </section>
      <BottomNavigation current="settings" onNavigate={onNavigate} />
      <ConfirmDialog
        open={confirmReset}
        title="Reset all local data?"
        message="This deletes the active game, completed history, reviews, and settings from this device. It cannot be undone."
        confirmLabel={busy ? "Resetting\u2026" : "Reset Everything"}
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          onReset();
        }}
      />
    </main>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange
}: {
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
