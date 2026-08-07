import Link from "next/link";
import type { Route } from "next";
import { cardLabel } from "@/lib/euchre";
import type { ClubReplayView } from "@/lib/presentation/club/replay";
import { PracticeRuleSummary } from "./practice-status";

const PLAYER_NAMES = ["South", "West", "North", "East"] as const;

export function PracticeReview({ view }: { view: ClubReplayView }) {
  return (
    <section id="game-review-panel" className="rounded border border-brass/35 bg-brass/10 p-4" data-testid="practice-review">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-brass">Game review</p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Team {view.winningTeam} wins {view.finalScore[0]} - {view.finalScore[1]}
          </h2>
          <p className="mt-1 text-sm text-white/60">{view.totalHands} hands | {view.totalEvents} immutable events</p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded border border-brass/40 px-4 py-2 text-sm font-semibold text-brass"
          href={`/club/replay/${view.gameId}` as Route}
        >
          Open native replay
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReviewMetric label="Euchres" value={view.totalEuchres} />
        <ReviewMetric label="Maker wins" value={view.totalSuccessfulMakerHands} />
        <ReviewMetric label="Maker fails" value={view.totalFailedMakerHands} />
        <ReviewMetric label="Lone attempts" value={view.totalLoneAttempts} />
      </div>

      <div className="mt-4"><PracticeRuleSummary summary={view.ruleSummary} /></div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">Per-seat persisted game statistics</caption>
          <thead className="text-xs uppercase tracking-[0.12em] text-white/45">
            <tr>
              <th className="border-b border-white/10 py-2 pr-3">Seat</th>
              <th className="border-b border-white/10 px-3 py-2">Team</th>
              <th className="border-b border-white/10 px-3 py-2">Calls</th>
              <th className="border-b border-white/10 px-3 py-2">Tricks</th>
              <th className="border-b border-white/10 py-2 pl-3">Loners</th>
            </tr>
          </thead>
          <tbody className="text-white/70">
            {view.seats.map((seat) => (
              <tr key={seat.seat}>
                <td className="border-b border-white/10 py-2 pr-3 font-semibold text-white">{PLAYER_NAMES[seat.seat]}</td>
                <td className="border-b border-white/10 px-3 py-2">{seat.team}</td>
                <td className="border-b border-white/10 px-3 py-2">{seat.successfulCalls}-{seat.failedCalls}</td>
                <td className="border-b border-white/10 px-3 py-2">{seat.tricksWon}</td>
                <td className="border-b border-white/10 py-2 pl-3">{seat.successfulLoners}/{seat.loneAttempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2">
        {view.hands.map((hand) => (
          <details key={hand.handNumber} className="rounded border border-white/10 bg-[#071411]/35 px-3 py-2 text-sm" open={hand.handNumber === 1}>
            <summary className="cursor-pointer text-white">
              Hand {hand.handNumber}: dealer {PLAYER_NAMES[hand.dealer]}, trump {hand.trump ?? "none"}, score {hand.scoreAfterHand[0]}-{hand.scoreAfterHand[1]}
            </summary>
            <div className="mt-3 grid gap-2 text-white/70 sm:grid-cols-2 lg:grid-cols-4">
              <ReviewDetail label="Upcard" value={hand.upcard ? cardLabel(hand.upcard) : "None"} />
              <ReviewDetail label="Caller" value={hand.maker === undefined ? "None" : PLAYER_NAMES[hand.maker]} />
              <ReviewDetail label="Alone" value={hand.alone ? "Yes" : "No"} />
              <ReviewDetail label="Result" value={formatScoringResult(hand.scoringResult)} />
            </div>
            <div className="mt-3 space-y-2">
              {hand.tricks.map((trick) => (
                <p key={trick.trickNumber} className="rounded border border-white/10 px-3 py-2 text-white/65">
                  Trick {trick.trickNumber}: {trick.cards.map((play) => `${PLAYER_NAMES[play.player]} ${play.cardLabel}`).join(", ")}. Winner: {PLAYER_NAMES[trick.winningSeat]}.
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function ReviewMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded border border-white/10 bg-[#071411]/40 px-3 py-2"><p className="text-xs uppercase tracking-[0.12em] text-white/45">{label}</p><p className="mt-1 text-lg font-semibold text-white">{value}</p></div>;
}

function ReviewDetail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-[0.12em] text-white/40">{label}</p><p className="font-semibold text-white">{value}</p></div>;
}

function formatScoringResult(result: ClubReplayView["hands"][number]["scoringResult"]): string {
  return {
    "makers-point": "Makers scored one",
    "makers-march": "Makers marched",
    "lone-march": "Lone march",
    euchre: "Makers euchred",
    passed: "Passed out"
  }[result];
}
