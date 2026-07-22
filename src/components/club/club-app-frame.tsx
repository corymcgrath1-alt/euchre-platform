import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { ClubNavigation } from "./club-navigation";
import styles from "./club-app-frame.module.css";

export function ClubAppFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href={"/club" as Route} aria-label="EUCHRE Competitive Card Club">
            <span className={styles.brandMark} aria-hidden="true">E</span>
            <span className={styles.brandCopy}>
              <strong>EUCHRE</strong>
              <span>Competitive Card Club</span>
            </span>
          </Link>
          <ClubNavigation />
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
