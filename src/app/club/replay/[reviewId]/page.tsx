import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReplayViewer } from "@/features/replay/replay-viewer";
import { GameNotFoundError } from "@/lib/persistence/types";
import { selectClubReplayStep } from "@/lib/presentation/club/replay-timeline";
import { isValidReviewId, loadReplayRouteProjection } from "@/lib/review/replay-service";
import styles from "../../club-detail.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Practice Replay | EUCHRE",
  description: "Viewer-safe replay reconstructed from immutable Platform events"
};

export default async function ReplayPage({
  params,
  searchParams
}: {
  params: Promise<{ reviewId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { reviewId } = await params;
  if (!isValidReviewId(reviewId)) notFound();

  let projection;
  try {
    projection = await loadReplayRouteProjection(reviewId, 0);
  } catch (error) {
    if (error instanceof GameNotFoundError) notFound();
    throw error;
  }

  return (
    <main className={styles.page} data-auth-state="local-unauthenticated">
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Immutable Practice history</p>
          <h1>Game replay</h1>
          <p>{reviewId}</p>
        </div>
        <Link className={styles.backLink} href="/club">Back to Club record</Link>
      </header>
      <p className={styles.sessionBand}>Local unauthenticated viewer: South. Each step is rebuilt from Platform events and filtered before it reaches this page.</p>

      {projection.status === "empty" ? (
        <ReplayState title="No replayable events" message="This persisted game exists but has no immutable move events to replay." />
      ) : projection.status === "unavailable" ? (
        <ReplayState title="Replay unavailable" message={projection.message} />
      ) : (
        <ReadyReplay projection={projection} requestedStep={(await searchParams).step} />
      )}
    </main>
  );
}

function ReadyReplay({
  projection,
  requestedStep
}: {
  projection: Extract<Awaited<ReturnType<typeof loadReplayRouteProjection>>, { status: "ready" }>;
  requestedStep?: string;
}) {
  const index = requestedStep === undefined ? 0 : Number(requestedStep);
  const step = Number.isInteger(index) ? selectClubReplayStep(projection.timeline, index) : undefined;
  if (!step) {
    return (
      <section className={styles.state}>
        <h2>Replay position unavailable</h2>
        <p>The requested timeline position is outside this persisted replay.</p>
        <Link className={styles.backLink} href={`/club/replay/${projection.timeline.gameId}?step=0` as Route}>Start at the first event</Link>
      </section>
    );
  }
  return <ReplayViewer gameId={projection.timeline.gameId} step={step} totalSteps={projection.timeline.steps.length} />;
}

function ReplayState({ title, message }: { title: string; message: string }) {
  return <section className={styles.state} data-testid="replay-unavailable"><h2>{title}</h2><p>{message}</p></section>;
}
