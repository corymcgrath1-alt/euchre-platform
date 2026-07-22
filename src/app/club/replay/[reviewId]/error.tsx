"use client";

import styles from "../../club-detail.module.css";

export default function ReplayError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.page}>
      <section className={styles.state} role="alert">
        <h1>Replay could not be loaded</h1>
        <p>The persisted review remains unchanged. Retry the server projection or return to the Club record.</p>
        <button className={styles.backLink} type="button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
