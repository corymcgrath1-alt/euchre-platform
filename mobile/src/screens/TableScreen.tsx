import { useEffect, useMemo, useState } from "react";
import { cardId, type Card, type GameAction } from "@/lib/euchre";
import type { ClubTableView } from "@/lib/presentation/club/table";
import { PlayingCard, ScreenHeader, SuitMark, cardAccessibleName, suitLabel } from "../components/mobile-ui";
import type { AnimationLevel } from "../persistence/mobile-event-store";

export function TableScreen({
  table,
  busy,
  animationLevel,
  onAction,
  onHome,
  onNewGame
}: {
  readonly table: ClubTableView;
  readonly busy: boolean;
  readonly animationLevel: AnimationLevel;
  readonly onAction: (action: GameAction) => void;
  readonly onHome: () => void;
  readonly onNewGame: () => void;
}) {
  const [alone, setAlone] = useState(false);
  const [selectedReplacementIds, setSelectedReplacementIds] = useState<readonly string[]>([]);
  const humanTurn = table.activePlayer === table.viewerSeat;
  const interactionLocked = busy || !humanTurn || table.currentTrick.isShowingCompletedTrick;

  useEffect(() => {
    setAlone(false);
    setSelectedReplacementIds([]);
  }, [table.phase, table.handNumber, table.activePlayer]);

  const replacementCards = useMemo(
    () => table.viewerHand.cards
      .filter((entry) => selectedReplacementIds.includes(entry.id))
      .map((entry) => entry.card),
    [selectedReplacementIds, table.viewerHand.cards]
  );

  return (
    <main
      className={`app-screen table-screen animation-${animationLevel}`}
      data-testid="active-table"
      aria-busy={busy}
    >
      <ScreenHeader
        title={`Hand ${table.handNumber}`}
        eyebrow={table.summary.scoreLabel}
        onBack={onHome}
        action={(
          <button className="button button--quiet button--compact" type="button" onClick={onNewGame}>
            New
          </button>
        )}
      />

      <section className="table-scorebar" aria-label="Game status">
        <div><span>Your team</span><strong>{table.scores[0]}</strong></div>
        <div className="table-scorebar__center">
          <strong>{table.summary.phaseLabel}</strong>
          <span>First to {table.config.targetScore}</span>
        </div>
        <div><span>Opponents</span><strong>{table.scores[1]}</strong></div>
      </section>

      <section className="felt-table" aria-label="Euchre table">
        <div className="table-facts">
          <span>Dealer: {seatName(table, table.dealer)}</span>
          <span>
            Trump: {table.trump ? <><SuitMark suit={table.trump} /> {suitLabel(table.trump)}</> : "Not set"}
          </span>
        </div>
        {table.upcard && !table.trump ? (
          <div className="upcard" aria-label={`Up card ${cardAccessibleName(table.upcard)}`}>
            <PlayingCard card={table.upcard} compact />
            <small>Up card</small>
          </div>
        ) : null}
        <div className="seat-grid">
          {table.seats.map((seat) => (
            <article
              key={seat.seat}
              className={`seat seat--${seat.position}${seat.isActive ? " seat--active" : ""}${seat.isSittingOut ? " seat--out" : ""}`}
              aria-label={`${seat.displayName}, ${seat.cardCount} cards${seat.isDealer ? ", dealer" : ""}${seat.isActive ? ", current turn" : ""}`}
            >
              <strong>{seat.displayName}</strong>
              <div className="seat__badges">
                {seat.isDealer ? <span>Dealer</span> : null}
                {seat.isCaller ? <span>Caller</span> : null}
                {seat.isSittingOut ? <span>Sitting out</span> : null}
              </div>
              {!seat.isViewer ? <span className="card-count" aria-hidden="true">{cardBacks(seat.cardCount)}</span> : null}
              {seat.recentAction ? <small>{seat.recentAction}</small> : null}
            </article>
          ))}
        </div>

        <CurrentTrick table={table} />
      </section>

      <section className="turn-guidance" aria-live="polite" aria-atomic="true">
        <strong>{table.turnPrompt.title}</strong>
        <span>{table.turnPrompt.body}</span>
      </section>

      <section className="hand-dock" aria-label="Your hand">
        <div className="hand-row">
          {table.viewerHand.cards.map((entry) => {
            const selectableForFarmers = table.legal.farmersHandReplaceableCardIds.includes(entry.id);
            const selected = selectedReplacementIds.includes(entry.id);
            const legal = entry.legal || selectableForFarmers;
            return (
              <button
                key={entry.id}
                type="button"
                className="card-button"
                data-testid="hand-card"
                aria-label={`${cardAccessibleName(entry.card)}${legal ? ", legal action" : ", not legal now"}`}
                aria-pressed={selected || undefined}
                disabled={interactionLocked || !legal}
                onClick={() => {
                  if (table.legal.canClaimFarmersHand && table.farmersHandMode === "replaceThree" && selectableForFarmers) {
                    setSelectedReplacementIds((current) => toggleSelection(current, entry.id, 3));
                    return;
                  }
                  if (table.legal.mustDiscard) {
                    onAction({ type: "DISCARD", player: 0, card: entry.card });
                    return;
                  }
                  onAction({ type: "PLAY_CARD", player: 0, card: entry.card });
                }}
              >
                <PlayingCard card={entry.card} legal={legal} selected={selected} />
              </button>
            );
          })}
        </div>

        <ActionControls
          table={table}
          alone={alone}
          busy={interactionLocked}
          replacementCards={replacementCards}
          onAlone={setAlone}
          onAction={onAction}
        />
      </section>
    </main>
  );
}

function CurrentTrick({ table }: { readonly table: ClubTableView }) {
  const trick = table.currentTrick;
  return (
    <div className="current-trick" aria-label={`Current trick, ${trick.plays.length} cards played`}>
      {trick.plays.length === 0 ? (
        <p>{table.phase === "playing" ? `${trick.leaderLabel} leads` : "Waiting for trump"}</p>
      ) : trick.plays.map((play) => (
        <div
          key={`${play.seat}-${cardId(play.card)}`}
          className={`trick-card trick-card--${positionForSeat(table, play.seat)}${play.isWinningCard ? " trick-card--winning" : ""}`}
          aria-label={`${play.playerName} played ${play.cardLabel}${play.isWinningCard ? ", currently winning" : ""}`}
        >
          <PlayingCard card={play.card} compact />
          <small>{seatName(table, play.seat)}</small>
        </div>
      ))}
      {trick.isShowingCompletedTrick && trick.latestCompletedWinnerLabel ? (
        <p className="trick-winner" role="status">{trick.latestCompletedWinnerLabel} wins the trick</p>
      ) : null}
    </div>
  );
}

function ActionControls({
  table,
  alone,
  busy,
  replacementCards,
  onAlone,
  onAction
}: {
  readonly table: ClubTableView;
  readonly alone: boolean;
  readonly busy: boolean;
  readonly replacementCards: readonly Card[];
  readonly onAlone: (alone: boolean) => void;
  readonly onAction: (action: GameAction) => void;
}) {
  const showAlone = table.legal.canOrderUp || table.legal.callableSuits.length > 0;
  return (
    <div className="action-controls" aria-label="Legal actions" data-testid="legal-actions">
      {showAlone ? (
        <label className="alone-toggle">
          <input type="checkbox" checked={alone} disabled={busy} onChange={(event) => onAlone(event.target.checked)} />
          <span>Go alone</span>
        </label>
      ) : null}
      {table.legal.canPass ? (
        <button className="button button--quiet" type="button" disabled={busy} onClick={() => onAction({ type: "PASS", player: 0 })}>
          Pass
        </button>
      ) : null}
      {table.legal.canOrderUp ? (
        <button className="button button--primary" type="button" disabled={busy} onClick={() => onAction({ type: "ORDER_UP", player: 0, alone })}>
          Order Up{alone ? " Alone" : ""}
        </button>
      ) : null}
      {table.legal.callableSuits.map((suit) => (
        <button
          className="button suit-button"
          type="button"
          key={suit}
          disabled={busy}
          aria-label={`Call ${suit}${alone ? " alone" : ""}`}
          onClick={() => onAction({ type: "CALL_TRUMP", player: 0, suit, alone })}
        >
          <SuitMark suit={suit} /> {suitLabel(suit)}
        </button>
      ))}
      {table.legal.canDeclineFarmersHand ? (
        <button className="button button--quiet" type="button" disabled={busy} onClick={() => onAction({ type: "FARMERS_HAND_DECLINE", player: 0 })}>
          Keep Hand
        </button>
      ) : null}
      {table.legal.canClaimFarmersHand && table.farmersHandMode === "redeal" ? (
        <button
          className="button button--primary"
          type="button"
          disabled={busy}
          onClick={() => onAction({ type: "FARMERS_HAND_REDEAL", player: 0, seed: nextRedealSeed(table) })}
        >
          Redeal
        </button>
      ) : null}
      {table.legal.canClaimFarmersHand && table.farmersHandMode === "replaceThree" ? (
        <button
          className="button button--primary"
          type="button"
          disabled={busy || replacementCards.length === 0}
          onClick={() => onAction({ type: "FARMERS_HAND_REPLACE", player: 0, cards: [...replacementCards] })}
        >
          Replace {replacementCards.length || "selected"}
        </button>
      ) : null}
      {table.viewerHand.mustDiscard ? <p className="action-hint">Choose one card to discard.</p> : null}
    </div>
  );
}

function seatName(table: ClubTableView, seat: number): string {
  return table.seats.find((entry) => entry.seat === seat)?.displayName ?? `Seat ${seat}`;
}

function positionForSeat(table: ClubTableView, seat: number): string {
  return table.seats.find((entry) => entry.seat === seat)?.position ?? "south";
}

function cardBacks(count: number): string {
  return count > 0 ? `${count} card${count === 1 ? "" : "s"}` : "No cards";
}

function toggleSelection(current: readonly string[], id: string, max: number): readonly string[] {
  if (current.includes(id)) return current.filter((value) => value !== id);
  return current.length >= max ? current : [...current, id];
}

function nextRedealSeed(table: ClubTableView): number {
  return Math.abs((table.handNumber * 104_729 + table.bids.length * 7_919 + 17) % 1_000_000);
}
