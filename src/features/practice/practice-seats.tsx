import type { BiddingTimelineView } from "@/lib/euchre";
import type { ClubTableSeatView } from "@/lib/presentation/club/table";
import { PracticeBadge, PracticeCardBackFan, displaySuitSymbol } from "./practice-ui";

export type PracticeSeatDecision = BiddingTimelineView["decisions"][number];

export function PracticeSeat({
  seat,
  decision
}: {
  seat: ClubTableSeatView;
  decision?: PracticeSeatDecision;
}) {
  const showDecision = decision && decision.label !== "none";
  const highlighted = seat.isActive || seat.isDealer;

  return (
    <section
      className={`relative z-10 flex ${seat.isViewer ? "min-h-14" : "min-h-24"} flex-col justify-between rounded-xl border ${
        seat.isViewer ? "px-3 py-2" : "p-2"
      } shadow-lg shadow-black/15 ${highlighted ? "border-brass bg-[#0c3d30]/80" : "border-white/10 bg-[#071411]/55"}`}
      data-seat={seat.seat}
      data-position={seat.position}
      data-testid={`practice-seat-${seat.position}`}
    >
      <div className={`flex items-start gap-2 ${seat.isViewer ? "justify-center text-center" : "justify-between"}`}>
        <div className={seat.isViewer ? "min-w-0" : undefined}>
          <h2 className="text-sm font-semibold text-white">{seat.displayName}</h2>
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">
            Team {seat.partnership} | {seat.isViewer ? "Human" : "Bot"}
          </p>
        </div>
        {seat.isActive ? <PracticeBadge tone="brass">Turn</PracticeBadge> : null}
      </div>

      {(seat.isDealer || seat.isCaller || seat.isSittingOut || showDecision) ? (
        <div className={`mt-1 flex flex-wrap gap-1 ${seat.isViewer ? "justify-center" : ""}`}>
          {seat.isDealer ? <PracticeBadge tone="brass">Dealer</PracticeBadge> : null}
          {seat.isCaller ? <PracticeBadge tone="brass">Caller</PracticeBadge> : null}
          {seat.isSittingOut ? <PracticeBadge>Sitting out</PracticeBadge> : null}
          {showDecision ? (
            <PracticeBadge tone={decision.label === "pass" ? "neutral" : "brass"}>
              {decisionLabel(decision)}
            </PracticeBadge>
          ) : null}
        </div>
      ) : null}

      {!seat.isViewer ? (
        <div className="mt-1">
          <PracticeCardBackFan count={seat.cardCount} compact />
        </div>
      ) : null}
    </section>
  );
}

export function decisionLabel(decision: PracticeSeatDecision): string {
  switch (decision.label) {
    case "ordered-up":
    case "assist":
      return "Ordered up";
    case "picked-up":
      return "Picked up";
    case "turned-down":
      return "Turned down";
    case "called":
      return decision.suit ? `Called ${displaySuitSymbol(decision.suit)}` : "Called";
    case "pass":
      return "Pass";
    case "none":
      return "Waiting";
  }
}
