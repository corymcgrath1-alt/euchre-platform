import type { FiveCardScoreView } from "@/lib/euchre";
import type { ClubTableView } from "@/lib/presentation/club/table";
import type { PracticeSeatDecision } from "./practice-seats";
import { PracticeSeat } from "./practice-seats";
import { displaySuitSymbol } from "./practice-ui";

export function PracticeScoreRow({
  northSeat,
  decision,
  scores
}: {
  northSeat: ClubTableView["seats"][number];
  decision?: PracticeSeatDecision;
  scores: ClubTableView["fiveCardScores"];
}) {
  return (
    <div className="grid items-center gap-2 lg:grid-cols-[1fr_minmax(13rem,18rem)_1fr]">
      <TeamScore team={0} score={scores[0]} align="right" />
      <div className="mx-auto w-full">
        <PracticeSeat seat={northSeat} decision={decision} />
      </div>
      <TeamScore team={1} score={scores[1]} align="left" />
    </div>
  );
}

function TeamScore({
  team,
  score,
  align
}: {
  team: 0 | 1;
  score: FiveCardScoreView;
  align: "left" | "right";
}) {
  const label = team === 0 ? "You / Partner" : "Opponents";
  return (
    <section
      className={`hidden w-fit rounded-xl border border-brass/25 bg-[#071411]/50 px-1.5 py-1 shadow-inner shadow-black/30 sm:flex sm:items-center sm:gap-1.5 ${
        align === "right" ? "justify-self-end" : "justify-self-start"
      }`}
      aria-label={score.accessibleLabel}
    >
      {align === "left" ? <StackedScoreCards score={score} /> : null}
      <div className={align === "right" ? "text-right" : "text-left"}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brass">{label}</p>
        <p className="mt-0.5 text-base font-black leading-none text-white">{score.clampedScore}</p>
      </div>
      {align === "right" ? <StackedScoreCards score={score} /> : null}
    </section>
  );
}

function StackedScoreCards({ score }: { score: FiveCardScoreView }) {
  return (
    <div className="five-card-score-stack relative h-24 w-28" aria-hidden="true">
      <CoveredFiveCard
        card={score.cards[0]}
        className={`score-card-base ${score.clampedScore === 0 ? "score-card-unused" : ""}`}
      />
      <CoveredFiveCard
        card={score.cards[1]}
        className={`score-card-cover ${scoreSecondCardClass(score.clampedScore)}`}
      />
      {score.isWinningScore ? (
        <span className="absolute -right-1 -top-1 rounded-full border border-brass/40 bg-brass px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#201602]">
          Win
        </span>
      ) : null}
    </div>
  );
}

function CoveredFiveCard({
  card,
  className = ""
}: {
  card: FiveCardScoreView["cards"][number];
  className?: string;
}) {
  return (
    <div className={`score-five-card absolute h-[5.35rem] w-[3.85rem] transition-transform ${className}`}>
      {card.faceUp ? (
        <FiveScoreFace card={card} />
      ) : (
        <div className="playing-card playing-card-back absolute inset-0 border border-brass/45 shadow-lg shadow-black/25" />
      )}
    </div>
  );
}

function FiveScoreFace({ card }: { card: FiveCardScoreView["cards"][number] }) {
  const suit = displaySuitSymbol(card.suit);
  const pipPositions = [
    "left-[0.42rem] top-[1.42rem]",
    "right-[0.42rem] top-[1.42rem]",
    "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
    "left-[0.42rem] bottom-[1.42rem]",
    "right-[0.42rem] bottom-[1.42rem]"
  ];

  return (
    <div className={`playing-card absolute inset-0 border border-slate-300 bg-[#fffdf6] shadow-lg shadow-black/30 ${
      card.color === "red" ? "text-[#b42318]" : "text-[#111827]"
    }`}>
      <div className="absolute left-1 top-1 flex flex-col items-center text-xs font-black leading-none">
        <span>5</span><span className="text-sm">{suit}</span>
      </div>
      <div className="absolute bottom-1 right-1 flex rotate-180 flex-col items-center text-xs font-black leading-none">
        <span>5</span><span className="text-sm">{suit}</span>
      </div>
      {pipPositions.map((position, index) => (
        <span key={position} className={`absolute ${position} text-lg leading-none ${index < card.visiblePips ? "opacity-100" : "opacity-10"}`}>
          {suit}
        </span>
      ))}
    </div>
  );
}

function scoreSecondCardClass(score: number): string {
  const classes = [
    "translate-x-[0.28rem] translate-y-[0.2rem] rotate-2",
    "translate-x-[1.95rem] translate-y-[0.35rem] rotate-3",
    "translate-x-[1.25rem] translate-y-[0.72rem] rotate-3",
    "translate-x-[0.72rem] translate-y-[1.05rem] rotate-2",
    "translate-x-[0.22rem] translate-y-[1.38rem] rotate-1",
    "translate-x-[2.25rem] translate-y-[0.25rem] rotate-5",
    "translate-x-[1.95rem] translate-y-[0.35rem] rotate-3",
    "translate-x-[1.25rem] translate-y-[0.72rem] rotate-3",
    "translate-x-[0.72rem] translate-y-[1.05rem] rotate-2",
    "translate-x-[0.22rem] translate-y-[1.38rem] rotate-1",
    "translate-x-[2.25rem] translate-y-[0.25rem] rotate-5"
  ];
  return classes[Math.max(0, Math.min(score, 10))];
}
