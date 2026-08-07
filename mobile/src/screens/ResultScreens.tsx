import type { ClubTableView } from "@/lib/presentation/club/table";
import type { CompletedGameListItem } from "../game/solo-game-service";
import { ScreenHeader, SuitMark, suitLabel } from "../components/mobile-ui";

export function HandResultScreen({
  table,
  autoDeal,
  busy,
  onContinue,
  onHome
}: {
  readonly table: ClubTableView;
  readonly autoDeal: boolean;
  readonly busy: boolean;
  readonly onContinue: () => void;
  readonly onHome: () => void;
}) {
  const result = table.handResult;
  return (
    <main className="app-screen result-screen" data-testid="hand-result-screen">
      <ScreenHeader title={`Hand ${table.handNumber}`} eyebrow="Hand result" onBack={onHome} />
      <section className="result-callout">
        <p className="eyebrow">{resultLabel(table)}</p>
        <h2>{result?.explanation ?? "The hand was passed out."}</h2>
        {result ? (
          <dl className="result-grid">
            <div><dt>Maker</dt><dd>{seatName(table, result.maker)}</dd></div>
            <div>
              <dt>Trump</dt>
              <dd><SuitMark suit={result.trump} /> {suitLabel(result.trump)}</dd>
            </div>
            <div><dt>Tricks</dt><dd>{result.tricksWon[0]} - {result.tricksWon[1]}</dd></div>
            <div><dt>Points</dt><dd>+{Math.max(...result.pointsAwarded)}</dd></div>
          </dl>
        ) : null}
      </section>
      <section className="score-summary" aria-label="Updated score">
        <div><span>Your team</span><strong>{table.scores[0]}</strong></div>
        <span aria-hidden="true">-</span>
        <div><span>Opponents</span><strong>{table.scores[1]}</strong></div>
      </section>
      <button className="button button--primary button--large" type="button" onClick={onContinue} disabled={busy}>
        {autoDeal && busy ? "Dealing next hand\u2026" : "Continue"}
      </button>
    </main>
  );
}

export function GameResultScreen({
  item,
  busy,
  shareAvailable,
  onReview,
  onShare,
  onPlayAgain,
  onHome
}: {
  readonly item: CompletedGameListItem;
  readonly busy: boolean;
  readonly shareAvailable: boolean;
  readonly onReview: () => void;
  readonly onShare: () => void;
  readonly onPlayAgain: () => void;
  readonly onHome: () => void;
}) {
  const won = item.review.winningTeam === 0;
  return (
    <main className="app-screen result-screen" data-testid="game-result-screen">
      <ScreenHeader title="Game Complete" eyebrow="Final result" onBack={onHome} />
      <section className={`game-result ${won ? "game-result--won" : "game-result--lost"}`}>
        <p className="eyebrow">{won ? "Victory" : "Defeat"}</p>
        <h2>{item.review.finalScore[0]} - {item.review.finalScore[1]}</h2>
        <p>{item.review.totalHandsPlayed} hands, {item.review.totalTricksPlayed} tricks</p>
      </section>
      <dl className="result-grid">
        <div><dt>Euchres</dt><dd>{item.review.totalEuchres}</dd></div>
        <div><dt>Lone attempts</dt><dd>{item.review.totalLoneAttempts}</dd></div>
        <div><dt>Successful loners</dt><dd>{item.review.totalSuccessfulLoneHands}</dd></div>
        <div><dt>Practice seed</dt><dd>{item.seed ?? "Unavailable"}</dd></div>
      </dl>
      <div className="stacked-actions">
        <button className="button button--primary" type="button" onClick={onReview}>Review Game</button>
        <button
          className="button button--secondary"
          type="button"
          onClick={onShare}
          disabled={busy}
          data-testid="share-result"
        >
          Share Result{shareAvailable ? "" : " (if supported)"}
        </button>
        <button className="button button--quiet" type="button" onClick={onPlayAgain}>Play Again</button>
        <button className="button button--quiet" type="button" onClick={onHome}>Return Home</button>
      </div>
    </main>
  );
}

function resultLabel(table: ClubTableView): string {
  if (!table.handResult) return "Passed hand";
  if (table.handResult.euchred) return "Euchre";
  if (table.handResult.lone && table.handResult.march) return "Lone march";
  if (table.handResult.march) return "March";
  return "Point scored";
}

function seatName(table: ClubTableView, seat: number): string {
  return table.seats.find((candidate) => candidate.seat === seat)?.displayName ?? `Seat ${seat}`;
}
