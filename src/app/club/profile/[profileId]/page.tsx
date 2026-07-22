import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildClubProfileDetailView } from "@/lib/presentation/club/profile";
import { loadProfileProjectionById } from "@/lib/profiles/profile-service";
import styles from "../../club-detail.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Practice Profile | EUCHRE",
  description: "Persisted Platform Practice profile detail"
};

export default async function ProfileDetailPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const projection = await loadProfileProjectionById(profileId);
  if (!projection) notFound();
  const view = buildClubProfileDetailView(projection.profile);

  return (
    <main className={styles.page} data-testid="profile-detail" data-profile-id={view.profileId} data-auth-state={view.authentication}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Local Practice profile</p>
          <h1>{view.displayName}</h1>
          <p>{view.seatLabel} seat | {view.partnershipLabel} partnership</p>
        </div>
        <Link className={styles.backLink} href="/club">Back to Club record</Link>
      </header>

      <p className={styles.sessionBand}>Local unauthenticated profile. Every statistic below is projected from completed persisted Practice games; no rating or competitive rank exists.</p>

      <section className={styles.section} aria-labelledby="career-heading">
        <p className={styles.eyebrow}>Persisted aggregates</p>
        <h2 id="career-heading">Career record</h2>
        <div className={styles.metrics}>
          <Metric label="Completed games" value={String(view.career.gamesPlayed)} />
          <Metric label="Record" value={`${view.career.wins}-${view.career.losses}`} />
          <Metric label="Win rate" value={formatPercentage(view.career.winPercentage)} />
          <Metric label="Call success" value={formatPercentage(view.career.callSuccessPercentage)} />
          <Metric label="Hands played" value={String(view.career.handsPlayed)} />
          <Metric label="Tricks won" value={String(view.career.tricksWon)} />
          <Metric label="Points for / against" value={`${view.career.pointsScored}/${view.career.pointsAllowed}`} />
          <Metric label="Lone hands" value={`${view.career.successfulLoners}/${view.career.loneAttempts}`} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="history-heading">
        <p className={styles.eyebrow}>Immutable history</p>
        <h2 id="history-heading">Completed games</h2>
        {view.isEmpty ? (
          <div className={styles.state} data-testid="profile-empty-history">
            <h3>No completed games</h3>
            <p>Finish a persisted Practice match to populate this profile and create a replay.</p>
            <Link className={styles.backLink} href="/">Open Practice</Link>
          </div>
        ) : (
          <ol className={styles.history}>
            {view.games.map((game) => (
              <li key={game.gameId}>
                <span>{game.result === "win" ? "Win" : "Loss"}</span>
                <strong>{game.pointsScored}-{game.pointsAllowed}</strong>
                <span>{game.handsPlayed} hands | {formatCompletedAt(game.completedAt)}</span>
                <Link className={styles.historyLink} href={game.replayHref as Route}>Replay</Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong></article>;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatCompletedAt(value?: string): string {
  if (!value) return "Completion time unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
