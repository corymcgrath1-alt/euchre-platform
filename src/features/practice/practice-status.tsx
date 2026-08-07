import type { RuleSummary } from "@/lib/euchre";
import type { ClubTableView } from "@/lib/presentation/club/table";
import { PracticeSuitIcon, suitFromLabel } from "./practice-ui";

export function PracticeTableStatus({ view }: { view: ClubTableView }) {
  const items = [
    ["Hand", view.status.handLabel],
    ["Phase", view.status.phaseLabel],
    ["Makers", view.status.makersLabel],
    ["Tricks", view.status.trickScoreLabel],
    ["Dealer", view.status.dealerLabel],
    ["Score", view.status.scoreLabel]
  ];
  const trick = view.currentTrick;

  return (
    <div className="rounded border border-white/10 bg-[#071411]/55 px-3 py-2" data-testid="practice-table-status">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="text-xs text-white/60" aria-live="polite">
          <span className="font-semibold uppercase tracking-[0.15em] text-brass">Table status</span>
          <span className="mx-2 text-white/25">|</span>
          <span>{view.status.targetLabel}</span>
          <span className="mx-2 text-white/25">|</span>
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>Trick {trick.trickNumber}: {trick.isShowingCompletedTrick && trick.nextLeaderLabel
              ? `${trick.currentWinnerLabel ?? trick.nextLeaderLabel} won, ${trick.nextLeaderLabel} leads next`
              : `${trick.leaderLabel} led`}</span>
            <PracticeSuitIcon suit={suitFromLabel(trick.ledSuitLabel)} label="Led suit" />
            <span>trump</span>
            <PracticeSuitIcon suit={suitFromLabel(trick.trumpLabel)} label="Trump" />
            <span>{trick.currentWinnerLabel && trick.winningCardLabel
              ? `${trick.currentWinnerLabel} winning with ${trick.winningCardLabel}`
              : waitingOnLabel(view)}</span>
          </span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-3 xl:w-[42rem] xl:grid-cols-6">
          {items.map(([label, value]) => (
            <div key={label} className={`rounded border px-2 py-1.5 ${
              label === "Dealer" ? "border-brass/50 bg-brass/15" : "border-white/10 bg-white/[0.035]"
            }`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</p>
              <p className="mt-0.5 text-xs font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PracticeTurnPanel({ view }: { view: ClubTableView }) {
  if (view.phase === "idle") return null;
  return (
    <section className="rounded border border-brass/30 bg-brass/10 p-4" aria-live="polite">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">Current turn</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{view.turn.title}</h2>
          <p className="mt-1 text-sm text-white/70">{view.turn.body}</p>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${
          view.turn.humanTurn ? "border-brass/40 text-brass" : "border-white/15 text-white/50"
        }`}>
          {view.turn.humanTurn ? "Human turn" : "Bot / table state"}
        </span>
      </div>
    </section>
  );
}

export function PracticeGameSummary({ view }: { view: ClubTableView }) {
  return (
    <section className="grid gap-3 rounded border border-white/10 bg-table p-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryItem label="Hand" value={view.handNumber ? String(view.handNumber) : "Not dealt"} />
      <SummaryItem label="Score" value={`Team 0 ${view.scores[0]} - ${view.scores[1]} Team 1`} />
      <SummaryItem label="Target" value={String(view.config.targetScore)} />
      <SummaryItem label="Phase" value={view.status.phaseLabel} />
      <SummaryItem label="Dealer" value={view.status.dealerLabel} />
      <SummaryItem label="Bot difficulty" value={view.config.botDifficultyLabel} />
      <SummaryItem label="Farmer" value={view.config.farmersHandModeLabel} />
      <SummaryItem label="Active" value={view.status.activePlayerLabel} />
      <SummaryItem label="Upcard" value={view.status.upcardLabel} />
      <SummaryItem label="Trump" value={view.status.trumpLabel} />
      <SummaryItem label="Makers" value={view.status.makersLabel} />
      <SummaryItem label="Tricks" value={view.status.trickScoreLabel} />
      {view.handResult ? (
        <p className="rounded border border-brass/40 bg-brass/10 px-3 py-2 text-sm text-brass sm:col-span-2 lg:col-span-4">
          Team 0 +{view.handResult.pointsAwarded[0]}, Team 1 +{view.handResult.pointsAwarded[1]}
        </p>
      ) : null}
      {view.phase === "handComplete" && !view.handResult ? (
        <p className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 sm:col-span-2 lg:col-span-4">
          Hand passed out. Deal rotates on the next hand.
        </p>
      ) : null}
      <div className="sm:col-span-2 lg:col-span-4">
        <PracticeRuleSummary summary={view.rules} />
      </div>
    </section>
  );
}

export function PracticeGameControls({
  view,
  disabled,
  onDealNextHand,
  onStartNewGame
}: {
  view: ClubTableView;
  disabled: boolean;
  onDealNextHand: () => void;
  onStartNewGame: () => void;
}) {
  if (view.phase === "handComplete") {
    return (
      <section className="rounded border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm text-white/70">{view.handResult?.explanation ?? "Hand passed out. Score unchanged."}</p>
        <p className="mt-2 text-xs font-semibold text-brass">Next hand will deal automatically.</p>
        <button
          type="button"
          className="mt-3 min-h-11 rounded bg-white px-4 py-2 text-sm font-semibold text-[#071411]"
          disabled={disabled || !view.gameControls.canStartNextHand}
          onClick={onDealNextHand}
        >
          Deal Next Hand Now
        </button>
      </section>
    );
  }
  if (view.phase === "gameComplete") {
    return (
      <section className="rounded border border-brass/40 bg-brass/10 p-4">
        <p className="font-semibold text-brass">Game complete.</p>
        <p className="mt-1 text-sm text-white/70">Final score: {view.scores[0]} - {view.scores[1]}. The persisted review is authoritative.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded border border-brass/40 px-4 py-2 text-sm font-semibold text-brass"
            disabled={disabled || !view.gameControls.canReviewGame}
            onClick={() => document.getElementById("game-review-panel")?.scrollIntoView({ behavior: "smooth" })}
          >
            Review Game
          </button>
          <button
            type="button"
            className="min-h-11 rounded bg-white px-4 py-2 text-sm font-semibold text-[#071411]"
            disabled={disabled || !view.gameControls.canStartNewGame}
            onClick={onStartNewGame}
          >
            Start New Game
          </button>
        </div>
      </section>
    );
  }
  return null;
}

export function PracticeActivity({
  view,
  botsOnly = false
}: {
  view: ClubTableView;
  botsOnly?: boolean;
}) {
  const activity = view.activity.filter((item) => !botsOnly || item.isBot);
  const visible = botsOnly ? activity.slice(-5) : activity;
  return (
    <section
      className="rounded border border-white/10 bg-white/[0.04] p-4"
      data-testid={botsOnly ? "practice-bot-activity" : "practice-move-log"}
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white/60">{botsOnly ? "Recent bot activity" : "Public move log"}</h2>
      <ol className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
        {visible.length ? visible.map((item) => (
          <li key={`${item.sequence}-${item.label}`} className="rounded border border-white/10 px-3 py-2 text-white/70">
            <span className="text-white/40">#{item.sequence}</span> {item.label}
          </li>
        )) : <li className="text-white/45">No public actions recorded yet.</li>}
      </ol>
    </section>
  );
}

export function PracticeBotRoster({ bots, difficulty }: { bots: readonly { id: string; name: string; seat: number }[]; difficulty: string }) {
  return (
    <section className="rounded border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white/60">Bots</h2>
        <span className="text-xs font-semibold text-brass">{difficulty}</span>
      </div>
      <div className="mt-3 space-y-2">
        {bots.map((bot) => (
          <div key={bot.id} className="flex items-center justify-between rounded border border-white/10 px-3 py-2 text-sm">
            <span>{bot.name}</span><span className="text-white/45">Seat {bot.seat}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PracticeRuleSummary({ summary }: { summary: RuleSummary }) {
  return (
    <section className="rounded border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Rules</p>
      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        {summary.items.map((item) => (
          <div key={item.label} className="rounded border border-white/10 px-2 py-2">
            <p className="uppercase tracking-[0.12em] text-white/35">{item.label}</p>
            <p className="mt-1 font-semibold text-white">{item.value}</p>
            {item.detail ? <p className="mt-1 text-white/45">{item.detail}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-[0.15em] text-white/45">{label}</p><p className="mt-1 text-base font-semibold text-white">{value}</p></div>;
}

function waitingOnLabel(view: ClubTableView): string {
  const trick = view.currentTrick;
  if (trick.unplayedSeats.length) {
    return trick.unplayedSeats.map((seat) => view.seats.find((candidate) => candidate.seat === seat)?.displayName ?? `Seat ${seat}`).join(", ");
  }
  return trick.latestCompletedWinnerLabel ? `Complete: ${trick.latestCompletedWinnerLabel}` : "Everyone played";
}
