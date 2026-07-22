import type { ClubTableView } from "@/lib/presentation/club/table";
import type { PracticeCommandHandlers } from "./practice-actions";
import { decisionLabel } from "./practice-seats";
import { PracticeBadge, PracticeSuitIcon } from "./practice-ui";

export function PracticeBiddingTimeline({ view }: { view: ClubTableView }) {
  const timeline = view.bidding;
  return (
    <section className="rounded border border-brass/20 bg-[#071411]/65 px-3 py-2 shadow-inner shadow-black/25" data-testid="practice-bidding-timeline">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <span className="font-semibold uppercase tracking-[0.14em] text-brass">Trump call</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">Dealer: {timeline.dealerLabel}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
              Upcard {timeline.upcardLabel}
              <PracticeSuitIcon suit={timeline.upcard?.suit ?? null} label="Upcard suit" compact />
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">Round {timeline.currentRound}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-white">
            <span>{timeline.summaryText}</span>
            <PracticeSuitIcon suit={timeline.finalTrumpSuit ?? null} label="Final trump" compact />
            {timeline.aloneSeat !== undefined ? <PracticeBadge tone="brass">Seat {timeline.aloneSeat} alone</PracticeBadge> : null}
          </p>
        </div>
        <div className="grid gap-1 sm:grid-cols-4 lg:min-w-[28rem]">
          {timeline.decisions.map((decision) => (
            <div key={decision.seat} className={`rounded border px-2 py-1 text-xs ${
              decision.label === "none" ? "border-white/10 bg-white/[0.03] text-white/35" : "border-brass/25 bg-brass/10 text-white/75"
            }`}>
              <p className="font-semibold text-white">{decision.playerLabel}</p>
              <p>{decision.label === "none" ? "Waiting" : decisionLabel(decision)}</p>
            </div>
          ))}
        </div>
      </div>
      {timeline.persistentLog.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-white/45">
          {timeline.persistentLog.slice(-5).map((line, index) => (
            <span key={`${line}-${index}`} className="rounded border border-white/10 bg-white/[0.03] px-2 py-1">{line}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function PracticeBiddingControls({
  view,
  alone,
  disabled,
  handlers,
  onAloneChange
}: {
  view: ClubTableView;
  alone: boolean;
  disabled: boolean;
  handlers: PracticeCommandHandlers;
  onAloneChange: (alone: boolean) => void;
}) {
  if (view.phase !== "ordering" && view.phase !== "calling") return null;
  const humanTurn = view.activePlayer === view.viewerSeat;

  return (
    <section className="mt-1 w-fit max-w-full rounded-lg border border-brass/25 bg-[#071411]/45 px-2 py-1.5" aria-label="Bidding controls">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {humanTurn ? (
          <label className="flex min-h-11 items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/70">
            <input type="checkbox" checked={alone} onChange={(event) => onAloneChange(event.target.checked)} />
            Go alone
          </label>
        ) : null}
        <button
          className="min-h-11 rounded border border-white/20 px-3 py-1.5 text-sm font-semibold text-white"
          disabled={disabled || !humanTurn || !view.legal.canPass}
          onClick={() => handlers.onPass()}
        >
          Pass
        </button>
        {view.phase === "ordering" ? (
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded bg-brass px-3 py-1.5 text-sm font-semibold text-[#201602]"
            disabled={disabled || !humanTurn || !view.legal.canOrderUp}
            onClick={() => handlers.onOrderUp(alone)}
          >
            <span>Order up</span>
            <PracticeSuitIcon suit={view.upcard?.suit ?? null} label="Upcard suit" light />
          </button>
        ) : null}
        {view.phase === "calling" ? view.legal.callableSuits.map((suit) => (
          <button
            key={suit}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-brass px-3 py-1.5 text-sm font-semibold text-[#201602]"
            disabled={disabled || !humanTurn}
            onClick={() => handlers.onCallTrump(suit, alone)}
          >
            <span>Call</span>
            <PracticeSuitIcon suit={suit} label="Trump suit" light />
          </button>
        )) : null}
      </div>
    </section>
  );
}
