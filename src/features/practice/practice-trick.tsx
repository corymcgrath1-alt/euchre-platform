import { buildTrickAnimationState } from "@/lib/euchre";
import type { ClubTablePosition, ClubTableView } from "@/lib/presentation/club/table";
import {
  PracticeBadge,
  PracticeCardBackFan,
  PracticeMiniCard,
  PracticePlayingCard,
  PracticeSuitIcon,
  suitFromLabel
} from "./practice-ui";

export function PracticeCurrentTrick({ view }: { view: ClubTableView }) {
  const trick = view.currentTrick;
  const playBySeat = new Map(trick.plays.map((play, index) => [play.seat, { play, index }]));
  const animation = buildTrickAnimationState(trick);
  const animationBySeat = new Map(animation.cards.map((card) => [card.seat, card]));
  const positionBySeat = new Map(view.seats.map((seat) => [seat.seat, seat.position]));
  const ledSuit = suitFromLabel(trick.ledSuitLabel);
  const trumpSuit = suitFromLabel(trick.trumpLabel);
  const statusText = trick.isShowingCompletedTrick
    ? `${trick.currentWinnerLabel ?? "Winner"} took it${trick.winningCardLabel ? ` with ${trick.winningCardLabel}` : ""}`
    : trick.plays.length
      ? `${trick.plays.length}/${view.lonePlayer === undefined ? 4 : 3} played`
      : "Awaiting lead";
  const dealerPosition = positionBySeat.get(view.dealer) ?? "south";

  return (
    <section
      className="relative z-10 overflow-hidden rounded-[1.5rem] border border-brass/25 bg-[#08271f]/55 p-2 shadow-inner shadow-black/35"
      data-testid="practice-current-trick"
      data-trick-phase={animation.phase}
      data-visible-card-count={trick.plays.length}
      data-collect-target={animation.collectTarget ?? "none"}
    >
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-start gap-1.5 text-xs">
        <span className="rounded-full border border-brass/30 bg-[#071411]/70 px-3 py-1 font-semibold text-brass">
          Trick {trick.trickNumber}
        </span>
        <span className="flex flex-col items-start gap-1 rounded-xl border border-white/10 bg-[#071411]/60 px-2 py-1 text-white/70">
          <span className="inline-flex items-center gap-1.5">
            <span>{trick.isShowingCompletedTrick && trick.nextLeaderLabel ? `Next lead ${trick.nextLeaderLabel}` : `Lead ${trick.leaderLabel}`}</span>
            <PracticeSuitIcon suit={ledSuit} label="Led suit" compact />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span>Trump</span>
            <PracticeSuitIcon suit={trumpSuit} label="Trump" compact />
          </span>
        </span>
      </div>

      <PracticeKitty position={dealerPosition} cardCount={view.kittyCardCount} upcard={view.upcard} />

      <div className="grid min-h-56 grid-cols-[minmax(5.5rem,1fr)_minmax(8rem,1.1fr)_minmax(5.5rem,1fr)] grid-rows-[minmax(5.5rem,1fr)_minmax(5rem,0.8fr)_minmax(5.5rem,1fr)] items-center gap-1.5 sm:min-h-60">
        {(["north", "west", "east", "south"] as ClubTablePosition[]).map((position) => {
          const seat = view.seats.find((candidate) => candidate.position === position);
          if (!seat) return null;
          return (
            <TrickSeat
              key={position}
              position={position}
              entry={playBySeat.get(seat.seat)}
              animationCard={animationBySeat.get(seat.seat)}
            />
          );
        })}

        <div className="col-start-2 row-start-2 mx-auto rounded-full border border-brass/20 bg-[#071411]/50 px-4 py-2 text-center shadow-inner shadow-black/40">
          <p className="text-sm font-semibold text-white">{statusText}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-white/40">
            {trick.isShowingCompletedTrick && trick.nextLeaderLabel
              ? `Next lead: ${trick.nextLeaderLabel}`
              : trick.currentWinnerLabel
                ? `Winning: ${trick.currentWinnerLabel}`
                : waitingOnLabel(view)}
          </p>
        </div>
      </div>

      {animation.phase === "collecting" && animation.winner.winnerLabel ? (
        <div className={`trick-collect-stack trick-collect-${animation.collectTarget ?? "center"}`} aria-hidden="true">
          {animation.cards.map((card) => (
            <span
              key={`${card.seat}-${card.cardLabel}`}
              className={`playing-card absolute h-16 w-12 border border-white bg-[#fffaf0] shadow-lg shadow-black/35 trick-stack-card-${card.playOrder}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TrickSeat({
  entry,
  position,
  animationCard
}: {
  entry?: { play: ClubTableView["currentTrick"]["plays"][number]; index: number };
  position: ClubTablePosition;
  animationCard?: ReturnType<typeof buildTrickAnimationState>["cards"][number];
}) {
  const play = entry?.play;
  const rotation = position === "west" ? "-rotate-6" : position === "east" ? "rotate-6" : position === "north" ? "rotate-2" : "-rotate-2";
  const gridClass = {
    north: "col-start-2 row-start-1 self-end",
    west: "col-start-1 row-start-2 justify-self-end",
    east: "col-start-3 row-start-2 justify-self-start",
    south: "col-start-2 row-start-3 self-start"
  }[position];

  return (
    <div className={gridClass}>
      <div
        className={`trick-seat-slot min-h-24 min-w-24 px-2 py-1.5 text-center ${
          play?.isWinningCard
            ? "rounded-xl border border-brass bg-brass/15 shadow-lg shadow-brass/10"
            : play ? "rounded-xl border border-white/10 bg-[#071411]/25" : ""
        }`}
        data-seat={position}
        data-slot={animationCard?.slot ?? "empty"}
        data-winning={play?.isWinningCard ? "true" : "false"}
      >
        {play ? (
          <>
            <div className="flex min-h-5 items-center justify-center gap-1.5">
              <p className="text-[11px] font-semibold text-white/70">{play.playerName}</p>
              {play.isLeader ? <PracticeBadge>Lead</PracticeBadge> : null}
            </div>
            <div className={`trick-play-card mx-auto mt-1 w-14 transition-transform sm:w-16 ${rotation}`} style={{ animationDelay: `${animationCard?.animationDelayMs ?? 0}ms` }}>
              <PracticePlayingCard card={play.card} playable size="trick" winning={play.isWinningCard} />
            </div>
            {play.isWinningCard ? <p className="mt-1 text-[11px] font-semibold text-brass">Winning</p> : null}
          </>
        ) : (
          <div className="h-24" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

function PracticeKitty({
  position,
  cardCount,
  upcard
}: {
  position: ClubTablePosition;
  cardCount: number;
  upcard: ClubTableView["upcard"];
}) {
  if (cardCount === 0 && !upcard) return null;
  const hiddenCount = Math.max(0, cardCount - (upcard ? 1 : 0));
  const positionClass = {
    south: "bottom-5 right-[23%]",
    west: "bottom-8 left-5",
    north: "right-[23%] top-12",
    east: "bottom-8 right-5"
  }[position];

  return (
    <div className={`pointer-events-none absolute z-10 ${positionClass}`} aria-label={`Kitty with ${hiddenCount} hidden cards`}>
      <div className="rounded-xl border border-brass/20 bg-[#071411]/60 px-2 py-1.5 shadow-lg shadow-black/35">
        <div className="relative h-20 w-16">
          <div className="absolute left-1 top-2 w-12" aria-hidden="true">
            <PracticeCardBackFan count={Math.max(1, Math.min(hiddenCount, 3))} compact />
          </div>
          {upcard ? <PracticeMiniCard card={upcard} className="absolute left-4 top-1 rotate-6" /> : null}
        </div>
      </div>
    </div>
  );
}

function waitingOnLabel(view: ClubTableView): string {
  const trick = view.currentTrick;
  if (trick.isShowingCompletedTrick && trick.nextLeaderLabel) return `Next lead: ${trick.nextLeaderLabel}`;
  if (trick.unplayedSeats.length) {
    return trick.unplayedSeats
      .map((seat) => view.seats.find((candidate) => candidate.seat === seat)?.displayName ?? `Seat ${seat}`)
      .join(", ");
  }
  return trick.latestCompletedWinnerLabel ? `Complete: ${trick.latestCompletedWinnerLabel}` : "Everyone played";
}
