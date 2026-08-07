import Link from "next/link";
import styles from "../../club-detail.module.css";

export default function ReplayNotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.state} data-testid="replay-not-found">
        <h1>Replay not found</h1>
        <p>No persisted Platform review matches this identifier. No demo data was substituted.</p>
        <Link className={styles.backLink} href="/club">Return to Club record</Link>
      </section>
    </main>
  );
}
