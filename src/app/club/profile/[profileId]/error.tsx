"use client";

import styles from "../../club-detail.module.css";

export default function ProfileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.page}>
      <section className={styles.state} role="alert">
        <h1>Profile could not be loaded</h1>
        <p>The persisted Practice record was not changed. Retry the server projection.</p>
        <button className={styles.backLink} type="button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
