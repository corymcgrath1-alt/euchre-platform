import type { Metadata, Route } from "next";
import Link from "next/link";
import { loadProfileProjectionBundle } from "@/lib/profiles/profile-service";
import { buildClubProfileDashboardView } from "@/lib/presentation/club/profile";
import styles from "./club.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Club Record | EUCHRE",
  description: "Real persisted Practice results and Euchre performance"
};

const HUMAN_SEAT = 0;

export default async function ClubPage() {
  const projection = await loadProfileProjectionBundle(HUMAN_SEAT);
  const view = buildClubProfileDashboardView(projection.summary, projection.profile);

  return (
    <main className={styles.page} data-testid="club-dashboard" data-auth-state={view.authentication}>
      <section className={styles.intro} aria-labelledby="club-heading">
        <div>
          <p className={styles.eyebrow}>Club record</p>
          <h1 id="club-heading">{view.displayName}</h1>
          <p className={styles.introCopy}>
            {view.seatLabel} seat · {view.partnershipLabel} partnership
          </p>
        </div>
        <div className={styles.introActions}>
          <Link className={styles.secondaryLink} href={`/club/profile/${view.profileId}` as Route}>Profile detail</Link>
          <Link className={styles.practiceLink} href="/">Play Practice</Link>
        </div>
      </section>

      <section className={styles.sessionBand} aria-label="Profile session status">
        <div>
          <strong>Local practice profile</strong>
          <span>Accounts are not connected. This record comes only from persisted games on this Platform store.</span>
        </div>
        <span className={styles.sourceBadge}>{view.sourceLabel}</span>
      </section>

      <section className={styles.recordBand} aria-labelledby="record-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Authoritative results</p>
            <h2 id="record-heading">Practice record</h2>
          </div>
          <p className={styles.recordScore} aria-label={`${view.record.wins} wins and ${view.record.losses} losses`}>
            <strong>{view.record.wins}</strong>
            <span>W</span>
            <i aria-hidden="true">/</i>
            <strong>{view.record.losses}</strong>
            <span>L</span>
          </p>
        </div>

        <div className={styles.metricsGrid}>
          <Metric label="Completed games" value={String(view.record.completedGames)} />
          <Metric label="Win rate" value={formatPercentage(view.record.winRate)} />
          <Metric label="Call success" value={formatPercentage(view.performance.callSuccess)} />
          <Metric label="Maker success" value={formatPercentage(view.performance.makerSuccess)} />
          <Metric label="Euchres made" value={String(view.performance.euchresEarned)} />
          <Metric label="Euchres suffered" value={String(view.performance.euchresSuffered)} />
        </div>
      </section>

      <section className={styles.historyBand} aria-labelledby="history-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Immutable game history</p>
            <h2 id="history-heading">Recent results</h2>
          </div>
        </div>

        {view.isEmpty ? (
          <div className={styles.emptyState}>
            <strong>No completed games yet</strong>
            <p>Finish a Practice match and its persisted review will appear here.</p>
            <Link className={styles.secondaryLink} href="/">Open Practice</Link>
          </div>
        ) : (
          <ol className={styles.historyList}>
            {view.recentGames.map((game) => (
              <li className={styles.historyRow} key={game.gameId}>
                <span className={game.result === "win" ? styles.resultWin : styles.resultLoss}>
                  {game.result === "win" ? "Win" : "Loss"}
                </span>
                <strong>{game.pointsScored} - {game.pointsAllowed}</strong>
                <span>{game.handsPlayed} hands</span>
                <span>{formatCompletedAt(game.completedAt)}</span>
                <Link className={styles.historyLink} href={`/club/replay/${game.gameId}` as Route}>Replay</Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatPercentage(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatCompletedAt(value?: string): string {
  if (!value) {
    return "Completion time unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}
