import type { ReactNode } from "react";
import {
  APP_BUILD_NUMBER,
  APP_VERSION,
  HAS_RELEASE_PLACEHOLDERS,
  PRIVACY_POLICY_URL,
  SUPPORT_REQUEST_URL,
  SUPPORT_URL
} from "../config/release";
import { ScreenHeader, SuitMark } from "../components/mobile-ui";

export function HowToPlayScreen({ onBack }: { readonly onBack: () => void }) {
  return (
    <main className="app-screen article-screen" data-testid="how-to-play-screen">
      <ScreenHeader title="How to Play" eyebrow="Euchre essentials" onBack={onBack} />
      <Article title="Bidding">
        Each player gets one chance to order the upcard&apos;s suit as trump. If everyone passes, call any other suit.
        With stick the dealer enabled, the dealer must call in round two.
      </Article>
      <Article title="Trump and bowers">
        The jack of trump is the right bower and highest card. The jack of the same color is the left bower,
        becomes trump, and no longer belongs to its printed suit.
      </Article>
      <Article title="Following suit">
        Follow the effective led suit when possible. If you cannot, play any card. The app enables only legal cards.
      </Article>
      <Article title="Scoring">
        Makers score 1 for three or four tricks and 2 for all five. Defenders score 2 for a euchre.
        A successful lone march scores 4.
      </Article>
      <Article title="Going alone">
        A caller may go alone. Their partner sits out, so each trick contains three cards.
      </Article>
      <Article title="House rules">
        Target score, first dealer, stick the dealer, and supported Farmer&apos;s Hand modes are configurable.
        Assisted loners are not available in version 1.0.
      </Article>
      <p className="suit-key">
        Suits: <SuitMark suit="clubs" label="clubs" /> <SuitMark suit="diamonds" label="diamonds" />{" "}
        <SuitMark suit="hearts" label="hearts" /> <SuitMark suit="spades" label="spades" />
      </p>
    </main>
  );
}

export function PrivacyScreen({ onBack }: { readonly onBack: () => void }) {
  return (
    <main className="app-screen article-screen" data-testid="privacy-screen">
      <ScreenHeader title="Privacy" eyebrow="Version 1.0" onBack={onBack} />
      <Article title="Stored on your device">
        Solo games, move history, reviews, settings, and practice seeds are stored locally so the game works offline.
        Euchre Club version 1.0 has no account, advertising, analytics, or tracking system.
      </Article>
      <Article title="Data sharing">
        Gameplay data does not leave the device during normal play. Information leaves the app only when you
        deliberately use the system share sheet, at which point you choose the destination.
      </Article>
      <Article title="Removing data">
        Use Reset Local Data in Settings to remove locally stored games and settings. Removing the app also removes
        its app-container data according to iOS behavior.
      </Article>
      <Article title="Network use">
        Core gameplay requires no network connection. Opening an external privacy or support link may use your browser.
      </Article>
      <a className="button button--secondary" href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
        Published Privacy Policy
      </a>
      {HAS_RELEASE_PLACEHOLDERS ? (
        <p className="release-warning" data-release-placeholder-warning>
          Owner action required: publish and configure the final privacy-policy URL before App Review.
        </p>
      ) : null}
    </main>
  );
}

export function SupportScreen({ onBack }: { readonly onBack: () => void }) {
  return (
    <main className="app-screen article-screen" data-testid="support-screen">
      <ScreenHeader title="Support" eyebrow={`Version ${APP_VERSION} (${APP_BUILD_NUMBER})`} onBack={onBack} />
      <Article title="Before contacting support">
        Record the app version, practice seed, phase, and what you expected to happen. Do not send private device
        information.
      </Article>
      <div className="stacked-actions">
        <a className="button button--primary" href={SUPPORT_URL} target="_blank" rel="noreferrer">Open Support Site</a>
        <a className="button button--secondary" href={SUPPORT_REQUEST_URL} target="_blank" rel="noreferrer">
          Report a Problem
        </a>
      </div>
      {HAS_RELEASE_PLACEHOLDERS ? (
        <p className="release-warning" data-release-placeholder-warning>
          Owner action required: replace the support URLs before App Review.
        </p>
      ) : null}
    </main>
  );
}

function Article({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}
