"use client";

import styles from "./club.module.css";

export default function ClubError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.page}>
      <section className={styles.errorState} role="alert">
        <p className={styles.eyebrow}>Profile unavailable</p>
        <h1>The persisted Club record could not be loaded.</h1>
        <p>Practice remains available. No replacement statistics have been generated.</p>
        <button className={styles.retryButton} type="button" onClick={reset}>Retry</button>
      </section>
    </main>
  );
}
