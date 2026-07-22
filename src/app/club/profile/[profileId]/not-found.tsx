import Link from "next/link";
import styles from "../../club-detail.module.css";

export default function ProfileNotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.state} data-testid="profile-not-found">
        <h1>Profile not found</h1>
        <p>No local persisted Practice profile matches this identifier. No fictional identity was substituted.</p>
        <Link className={styles.backLink} href="/club">Return to Club record</Link>
      </section>
    </main>
  );
}
