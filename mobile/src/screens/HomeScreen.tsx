import { BottomNavigation } from "../components/mobile-ui";

export function HomeScreen({
  hasActiveGame,
  onNewGame,
  onResume,
  onNavigate
}: {
  readonly hasActiveGame: boolean;
  readonly onNewGame: () => void;
  readonly onResume: () => void;
  readonly onNavigate: (screen: "history" | "settings" | "how" | "privacy" | "support") => void;
}) {
  return (
    <main className="app-screen home-screen" data-testid="home-screen">
      <section className="home-hero" aria-labelledby="home-title">
        <p className="eyebrow">Offline solo Euchre</p>
        <h1 id="home-title">Euchre Club</h1>
        <p>One table. Three sharp opponents. Every hand stays on your device.</p>
      </section>

      <section className="home-actions" aria-label="Play">
        {hasActiveGame ? (
          <button className="button button--primary button--large" type="button" onClick={onResume}>
            Resume Game
          </button>
        ) : null}
        <button
          className={hasActiveGame ? "button button--secondary button--large" : "button button--primary button--large"}
          type="button"
          onClick={onNewGame}
        >
          {hasActiveGame ? "New Game" : "Play Solo"}
        </button>
      </section>

      <section className="home-links" aria-label="Learn and support">
        <button type="button" onClick={() => onNavigate("how")}>How to Play</button>
        <button type="button" onClick={() => onNavigate("privacy")}>Privacy</button>
        <button type="button" onClick={() => onNavigate("support")}>Support</button>
      </section>

      <BottomNavigation current="home" onNavigate={(screen) => {
        if (screen !== "home") onNavigate(screen);
      }} />
    </main>
  );
}
