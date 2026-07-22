"use client";

import type { ClubTablePosition, ClubTableView } from "@/lib/presentation/club/table";
import type { PracticeCommandHandlers } from "./practice-actions";
import { PracticeBiddingTimeline } from "./practice-bidding";
import { PracticeViewerHand } from "./practice-hand";
import { PracticeScoreRow } from "./practice-score";
import { PracticeSeat } from "./practice-seats";
import { PracticeTableStatus } from "./practice-status";
import { PracticeCurrentTrick } from "./practice-trick";

export function PracticeTable({
  view,
  disabled,
  handlers
}: {
  view: ClubTableView;
  disabled: boolean;
  handlers: PracticeCommandHandlers;
}) {
  const seatByPosition = Object.fromEntries(
    view.seats.map((seat) => [seat.position, seat])
  ) as Record<ClubTablePosition, ClubTableView["seats"][number]>;
  const decisionFor = (seat: number) => view.bidding.decisions.find((decision) => decision.seat === seat);

  return (
    <section className="flex flex-col gap-2" data-testid="practice-table">
      <div className="euchre-table-rail rounded-[2rem] p-1.5 shadow-xl shadow-black/20 sm:p-2">
        <div className="euchre-felt rounded-[1.55rem] p-1.5 sm:p-2 lg:p-2.5">
          <div className="grid gap-2">
            <PracticeScoreRow
              northSeat={seatByPosition.north}
              scores={view.fiveCardScores}
              decision={decisionFor(seatByPosition.north.seat)}
            />

            <div className="grid gap-2 lg:grid-cols-[minmax(12rem,18rem)_minmax(30rem,1fr)_minmax(12rem,18rem)] lg:items-center xl:grid-cols-[minmax(13rem,20rem)_minmax(36rem,1fr)_minmax(13rem,20rem)]">
              <div className="w-full lg:justify-self-end">
                <PracticeSeat seat={seatByPosition.west} decision={decisionFor(seatByPosition.west.seat)} />
              </div>
              <PracticeCurrentTrick view={view} />
              <div className="w-full lg:justify-self-start">
                <PracticeSeat seat={seatByPosition.east} decision={decisionFor(seatByPosition.east.seat)} />
              </div>
            </div>

            <PracticeViewerHand
              view={view}
              seat={seatByPosition.south}
              decision={decisionFor(seatByPosition.south.seat)}
              disabled={disabled}
              handlers={handlers}
            />
          </div>
        </div>
      </div>
      <PracticeBiddingTimeline view={view} />
      <PracticeTableStatus view={view} />
    </section>
  );
}
