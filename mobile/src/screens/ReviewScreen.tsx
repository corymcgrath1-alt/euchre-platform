import { useMemo, useState } from "react";
import type { HandReview } from "@/lib/review/game-review";
import type { CompletedGameListItem } from "../game/solo-game-service";
import { PlayingCard, ScreenHeader, SuitMark, suitLabel } from "../components/mobile-ui";

export function ReviewScreen({
  item,
  onBack
}: {
  readonly item: CompletedGameListItem;
  readonly onBack: () => void;
}) {
  const [handIndex, setHandIndex] = useState(0);
  const hand = item.review.hands[handIndex];
  const outcome = item.review.winningTeam === 0 ? "Win" : "Loss";
  return (
    <main className="app-screen review-screen" data-testid="review-screen">
      <ScreenHeader title="Game Review" eyebrow={`${outcome} ${item.review.finalScore[0]}-${item.review.finalScore[1]}`} onBack={onBack} />
      <div className="review-hand-nav" aria-label="Review hand navigation">
        <button
          className="icon-button"
          type="button"
          aria-label="Previous hand"
          disabled={handIndex === 0}
          onClick={() => setHandIndex((index) => Math.max(0, index - 1))}
        >
          {"\u2039"}
        </button>
        <label>
          <span>Hand</span>
          <select value={handIndex} onChange={(event) => setHandIndex(Number(event.target.value))}>
            {item.review.hands.map((entry, index) => (
              <option key={entry.handNumber} value={index}>Hand {entry.handNumber}</option>
            ))}
          </select>
        </label>
        <button
          className="icon-button"
          type="button"
          aria-label="Next hand"
          disabled={handIndex >= item.review.hands.length - 1}
          onClick={() => setHandIndex((index) => Math.min(item.review.hands.length - 1, index + 1))}
        >
          {"\u203a"}
        </button>
      </div>
      {hand ? <HandReviewCard hand={hand} /> : (
        <section className="empty-state"><h2>No replayable hands</h2><p>This game has no completed hand review.</p></section>
      )}
    </main>
  );
}

function HandReviewCard({ hand }: { readonly hand: HandReview }) {
  const bids = useMemo(() => [...hand.roundOneBids, ...hand.roundTwoBids], [hand]);
  return (
    <>
      <section className="review-summary">
        <div>
          <span>Dealer</span>
          <strong>{seatLabel(hand.dealer)}</strong>
        </div>
        <div>
          <span>Trump</span>
          <strong>{hand.trumpSuit ? <><SuitMark suit={hand.trumpSuit} /> {suitLabel(hand.trumpSuit)}</> : "None"}</strong>
        </div>
        <div>
          <span>Result</span>
          <strong>{resultLabel(hand)}</strong>
        </div>
        <div>
          <span>Score after</span>
          <strong>{hand.teamScoreAfterHand[0]} - {hand.teamScoreAfterHand[1]}</strong>
        </div>
      </section>
      <section className="review-section">
        <h2>Bidding</h2>
        {bids.length ? (
          <ol className="event-list">
            {bids.map((bid) => (
              <li key={bid.sequenceNumber}>
                <span>{seatLabel(bid.player)}</span>
                <strong>{bid.decision === "call" ? `called ${bid.suit}` : bid.decision.replace("-", " ")}</strong>
                {bid.alone ? <small>Alone</small> : null}
              </li>
            ))}
          </ol>
        ) : <p>Passed without a call.</p>}
      </section>
      <section className="review-section">
        <h2>Tricks</h2>
        {hand.tricks.length ? hand.tricks.map((trick) => (
          <article className="review-trick" key={trick.trickNumber}>
            <header>
              <strong>Trick {trick.trickNumber}</strong>
              <span>{seatLabel(trick.winningSeat)} won</span>
            </header>
            <div className="review-cards">
              {trick.cardsPlayed.map((play) => (
                <div key={play.sequenceNumber} aria-label={`${seatLabel(play.player)} played ${play.card.rank} of ${play.card.suit}`}>
                  <PlayingCard card={play.card} compact />
                  <small>{seatLabel(play.player)}</small>
                </div>
              ))}
            </div>
          </article>
        )) : <p>No tricks were played.</p>}
      </section>
    </>
  );
}

function seatLabel(seat: number): string {
  return ["You", "West", "North", "East"][seat] ?? `Seat ${seat}`;
}

function resultLabel(hand: HandReview): string {
  if (hand.passed) return "Passed";
  if (hand.euchred) return "Euchre";
  if (hand.loneSucceeded) return "Lone march";
  if (hand.makerTricks === 5) return "March";
  return `${hand.pointsAwarded[0]}-${hand.pointsAwarded[1]} points`;
}
