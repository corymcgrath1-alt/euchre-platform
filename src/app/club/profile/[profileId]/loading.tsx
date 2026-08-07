import styles from "../../club-detail.module.css";

export default function ProfileLoading() {
  return <main className={styles.page} aria-busy="true" aria-label="Loading persisted profile"><div className={styles.loading} /></main>;
}
