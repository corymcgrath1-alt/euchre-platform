"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import type { ClubReplayStep } from "@/lib/presentation/club/replay-timeline";
import styles from "@/app/club/club-detail.module.css";

export function ReplayViewer({ gameId, step, totalSteps }: { gameId: string; step: ClubReplayStep; totalSteps: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const view = step.table;

  function goTo(index: number) {
    const bounded = Math.max(0, Math.min(index, totalSteps - 1));
    router.push(`${pathname}?step=${bounded}` as Route);
  }

  return (
    <div className={styles.replay} data-testid="replay-viewer" data-review-id={gameId}>
      <section className={styles.replayControls} aria-label="Replay navigation">
        <button type="button" disabled={step.index === 0} onClick={() => goTo(step.index - 1)}>Previous event</button>
        <label>
          <span>Timeline position</span>
          <input aria-label="Replay timeline position" type="range" min={0} max={Math.max(totalSteps - 1, 0)} value={step.index} onChange={(event) => goTo(Number(event.target.value))} />
        </label>
        <button type="button" disabled={step.index >= totalSteps - 1} onClick={() => goTo(step.index + 1)}>Next event</button>
        <p role="status" aria-live="polite">Step {step.index + 1} of {totalSteps}</p>
      </section>

      <section className={styles.eventBand} aria-labelledby="replay-event-heading">
        <p className={styles.eyebrow}>{step.kind.replaceAll("-", " ")}</p>
        <h2 id="replay-event-heading">{step.label}</h2>
        <p>{step.detail}</p>
      </section>

      <section className={styles.replayTable} aria-label="Viewer-safe table state">
        <div className={styles.publicStatus}>
          <span>Hand {view.handNumber}</span><span>Score {view.scores[0]}-{view.scores[1]}</span>
          <span>Dealer {view.status.dealerLabel}</span><span>Trump {view.status.trumpLabel}</span><span>Phase {view.status.phaseLabel}</span>
        </div>

        <div className={styles.seatGrid}>
          {view.seats.map((seat) => (
            <article key={seat.seat} className={styles.replaySeat} data-position={seat.position}>
              <strong>{seat.displayName}</strong><span>Team {seat.partnership}</span>
              <span>{seat.isViewer ? `${seat.cardCount} visible cards` : `${seat.cardCount} hidden cards`}</span>
              <span>{[seat.isDealer ? "Dealer" : "", seat.isActive ? "Turn" : "", seat.isSittingOut ? "Sitting out" : ""].filter(Boolean).join(" | ")}</span>
            </article>
          ))}
        </div>

        <div className={styles.replayFacts}>
          <div>
            <h3>Bidding</h3>
            <ol>{view.bids.length ? view.bids.map((bid, index) => (
              <li key={`${bid.player}-${bid.round}-${index}`}>Round {bid.round}: seat {bid.player} {bid.decision}{bid.suit ? ` ${bid.suit}` : ""}{bid.alone ? " alone" : ""}</li>
            )) : <li>No bids recorded yet.</li>}</ol>
          </div>
          <div>
            <h3>Current trick</h3>
            <ol data-testid="replay-public-trick">{view.currentTrick.plays.length ? view.currentTrick.plays.map((play) => (
              <li key={`${play.seat}-${play.cardId}`}>{play.playerName}: {play.cardLabel}{play.isWinningCard ? " (winning)" : ""}</li>
            )) : <li>No cards in the center.</li>}</ol>
          </div>
        </div>

        <section className={styles.viewerHand} aria-labelledby="replay-hand-heading">
          <h3 id="replay-hand-heading">What {view.seats.find((seat) => seat.isViewer)?.displayName ?? "the viewer"} knew</h3>
          <ul data-testid="replay-viewer-hand">{view.viewerHand.cards.map((card) => <li key={card.id}>{card.label}</li>)}</ul>
        </section>

        {step.kind === "final-result" ? (
          <p className={styles.finalResult} data-testid="replay-final-result">Authoritative final score: Team 0 {view.scores[0]}, Team 1 {view.scores[1]}</p>
        ) : null}
      </section>
    </div>
  );
}
