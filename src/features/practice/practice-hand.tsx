"use client";

import { useEffect, useMemo, useState } from "react";
import { cardLabel, type Card } from "@/lib/euchre";
import type { ClubTableView } from "@/lib/presentation/club/table";
import type { PracticeCommandHandlers } from "./practice-actions";
import { PracticeBiddingControls } from "./practice-bidding";
import type { PracticeSeatDecision } from "./practice-seats";
import { PracticeSeat } from "./practice-seats";
import { PracticePlayingCard } from "./practice-ui";

export function PracticeViewerHand({
  view,
  seat,
  decision,
  disabled,
  handlers
}: {
  view: ClubTableView;
  seat: ClubTableView["seats"][number];
  decision?: PracticeSeatDecision;
  disabled: boolean;
  handlers: PracticeCommandHandlers;
}) {
  const [alone, setAlone] = useState(false);
  const [selectedReplacementIds, setSelectedReplacementIds] = useState<readonly string[]>([]);
  const replacementIds = useMemo(() => new Set(view.legal.farmersHandReplaceableCardIds), [view.legal.farmersHandReplaceableCardIds]);
  const selectedCards = view.viewerHand.cards
    .filter((card) => selectedReplacementIds.includes(card.id))
    .map((card) => ({ ...card.card }));
  const selectionActive = isFarmersSelectionActive(view);
  const highlighted = seat.isActive || seat.isDealer;

  useEffect(() => {
    setAlone(false);
    setSelectedReplacementIds([]);
  }, [view.activePlayer, view.handNumber, view.phase]);

  function toggleReplacement(card: ClubTableView["viewerHand"]["cards"][number]) {
    if (!selectionActive || !replacementIds.has(card.id)) return;
    setSelectedReplacementIds((current) => {
      if (current.includes(card.id)) return current.filter((id) => id !== card.id);
      return current.length >= 3 ? current : [...current, card.id];
    });
  }

  function handleCard(card: ClubTableView["viewerHand"]["cards"][number]) {
    if (selectionActive) {
      toggleReplacement(card);
      return;
    }
    if (!card.legal || disabled) return;
    const cloned = cloneCard(card.card);
    if (view.legal.mustDiscard) {
      void handlers.onDiscard(cloned);
    } else {
      void handlers.onPlayCard(cloned);
    }
  }

  return (
    <section className={`relative z-10 mx-auto w-fit max-w-full rounded-xl border px-2 py-1.5 shadow-lg shadow-black/20 ${
      highlighted ? "border-brass bg-[#0c3d30]/80" : "border-white/10 bg-[#071411]/55"
    }`} data-testid="practice-viewer-hand">
      <div className="flex flex-col items-center justify-center gap-1.5">
        <div className="w-full max-w-[11rem]">
          <PracticeSeat seat={seat} decision={decision} />
        </div>
        <FarmersHandControls
          view={view}
          disabled={disabled}
          selectedCards={selectedCards}
          handlers={handlers}
        />
        <PracticeBiddingControls
          view={view}
          alone={alone}
          disabled={disabled}
          handlers={handlers}
          onAloneChange={setAlone}
        />
      </div>

      <div className="mt-2 grid grid-cols-3 justify-center gap-1.5 sm:grid-cols-5 lg:flex lg:flex-wrap lg:justify-center">
        {view.viewerHand.cards.map((card) => {
          const selected = selectedReplacementIds.includes(card.id);
          const eligible = replacementIds.has(card.id);
          const selectionBlocked = selectionActive && !selected && selectedReplacementIds.length >= 3;
          const actionable = selectionActive ? eligible && !selectionBlocked : card.legal;
          return (
            <button
              key={card.id}
              type="button"
              data-card-id={card.id}
              data-legal={card.legal ? "true" : "false"}
              data-testid={`viewer-card-${card.id}`}
              className={`group min-h-11 rounded-xl p-0 transition disabled:opacity-100 ${
                actionable ? "hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass" : ""
              } ${selected ? "-translate-y-1" : ""} disabled:cursor-not-allowed disabled:hover:translate-y-0`}
              disabled={disabled || !actionable}
              aria-pressed={selectionActive ? selected : undefined}
              aria-label={cardActionLabel(view, card.card, selectionActive, selected)}
              onClick={() => handleCard(card)}
            >
              <PracticePlayingCard card={card.card} playable={actionable} size="hand" selected={selected} />
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-center" aria-live="polite">
        <p className="text-xs font-semibold text-brass">{view.viewerHand.actionLabel}</p>
        <p className="mt-0.5 text-xs text-white/55">{view.viewerHand.helperText}</p>
      </div>
    </section>
  );
}

function FarmersHandControls({
  view,
  disabled,
  selectedCards,
  handlers
}: {
  view: ClubTableView;
  disabled: boolean;
  selectedCards: readonly Card[];
  handlers: PracticeCommandHandlers;
}) {
  const humanTurn = view.activePlayer === view.viewerSeat;
  if (!humanTurn || !view.legal.canClaimFarmersHand) return null;

  return (
    <section className="mt-1 w-fit max-w-full rounded-lg border border-brass/25 bg-[#071411]/45 px-2 py-1.5" aria-label="Farmer's Hand controls">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-brass">Farmer&apos;s Hand</span>
        {view.phase === "farmersHand" ? (
          <button
            type="button"
            className="min-h-11 rounded border border-white/20 px-3 py-1.5 text-sm text-white"
            disabled={disabled || !view.legal.canDeclineFarmersHand}
            onClick={() => handlers.onDeclineFarmersHand()}
          >
            Decline
          </button>
        ) : null}
        {view.config.farmersHandMode === "redeal" ? (
          <button
            type="button"
            className="min-h-11 rounded bg-brass px-3 py-1.5 text-sm font-semibold text-[#201602]"
            disabled={disabled}
            onClick={() => handlers.onClaimFarmersHandRedeal()}
          >
            Claim redeal
          </button>
        ) : null}
        {view.config.farmersHandMode === "replaceThree" ? (
          <button
            type="button"
            className="min-h-11 rounded bg-brass px-3 py-1.5 text-sm font-semibold text-[#201602]"
            disabled={disabled || selectedCards.length === 0}
            onClick={() => handlers.onReplaceFarmersHandCards(selectedCards)}
          >
            Replace selected ({selectedCards.length}/3)
          </button>
        ) : null}
      </div>
    </section>
  );
}

function isFarmersSelectionActive(view: ClubTableView): boolean {
  return (view.phase === "farmersHand" || view.phase === "ordering" || view.phase === "calling")
    && view.activePlayer === view.viewerSeat
    && view.legal.canClaimFarmersHand
    && view.config.farmersHandMode === "replaceThree";
}

function cardActionLabel(view: ClubTableView, card: Card, selectionActive: boolean, selected: boolean): string {
  const label = cardLabel(card);
  if (selectionActive) return `${selected ? "Deselect" : "Select"} ${label} for Farmer's Hand`;
  if (view.legal.mustDiscard) return `Discard ${label}`;
  return view.legal.playableCardIds.includes(`${card.rank}-${card.suit}`) ? `Play ${label}` : `${label} is not legal`;
}

function cloneCard(card: Card): Card {
  return { rank: card.rank, suit: card.suit };
}
