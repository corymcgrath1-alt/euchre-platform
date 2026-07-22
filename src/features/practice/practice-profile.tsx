import Link from "next/link";
import type { Route } from "next";
import type { PlayerIndex } from "@/lib/euchre";
import type { ProfileAggregateSummary } from "@/lib/profiles/profile-aggregates";
import type { PlayerProfileDetail } from "@/lib/profiles/profile-detail";

export function PracticeProfilePanel({
  profiles,
  selectedSeat,
  detail,
  onSelectSeat
}: {
  profiles: ProfileAggregateSummary | null;
  selectedSeat: PlayerIndex;
  detail: PlayerProfileDetail | null;
  onSelectSeat: (seat: PlayerIndex) => void;
}) {
  return (
    <section className="rounded border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white/60">Profiles</h2>
        <span className="text-xs text-white/45">Persisted Practice only</span>
      </div>
      {profiles ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {profiles.players.map((player) => (
              <button
                key={player.profileId}
                type="button"
                className={`min-h-11 rounded border px-2 py-2 text-left text-xs ${selectedSeat === player.seat ? "border-brass bg-brass/10 text-white" : "border-white/10 text-white/60"}`}
                onClick={() => onSelectSeat(player.seat)}
              >
                <strong className="block text-white">{player.name}</strong>
                {player.wins}-{player.losses} record
              </button>
            ))}
          </div>
          {detail ? (
            <div className="mt-3 rounded border border-white/10 bg-[#071411]/40 p-3 text-xs text-white/65">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm text-white">{detail.name}</strong>
                <span>{detail.career.wins}-{detail.career.losses}</span>
              </div>
              <p className="mt-2">Calls {detail.career.successfulCalls}-{detail.career.failedCalls} | Tricks {detail.career.tricksWon}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="inline-flex min-h-11 items-center rounded border border-brass/40 px-3 py-2 font-semibold text-brass" href={`/club/profile/${detail.profileId}` as Route}>
                  Open profile detail
                </Link>
                {detail.gameHistory[0] ? (
                  <Link className="inline-flex min-h-11 items-center rounded border border-white/20 px-3 py-2 font-semibold text-white" href={detail.gameHistory[0].reviewHref as Route}>
                    Latest replay
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-white/45">Complete a persisted game to populate local profile stats.</p>
      )}
    </section>
  );
}
