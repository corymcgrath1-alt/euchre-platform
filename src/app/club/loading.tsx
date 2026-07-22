import styles from "./club.module.css";

export default function ClubLoading() {
  return (
    <main className={styles.page} aria-busy="true" aria-label="Loading Club record">
      <div className={styles.loadingIntro} />
      <div className={styles.loadingBand} />
      <div className={styles.loadingMetrics}>
        {Array.from({ length: 6 }, (_, index) => <div className={styles.loadingMetric} key={index} />)}
      </div>
    </main>
  );
}
