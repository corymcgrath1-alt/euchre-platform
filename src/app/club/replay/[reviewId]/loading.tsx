import styles from "../../club-detail.module.css";

export default function ReplayLoading() {
  return <main className={styles.page} aria-busy="true" aria-label="Loading persisted replay"><div className={styles.loading} /></main>;
}
