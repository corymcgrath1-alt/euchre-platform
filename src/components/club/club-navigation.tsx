"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CLUB_NAVIGATION_ITEMS,
  isNavigationItemActive,
  navigationStatusLabel
} from "@/lib/presentation/club/navigation";
import styles from "./club-app-frame.module.css";

export function ClubNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.navigation} aria-label="Primary navigation">
      <ul className={styles.navigationList}>
        {CLUB_NAVIGATION_ITEMS.map((item) => {
          const status = navigationStatusLabel(item.availability);
          const active = isNavigationItemActive(item, pathname);

          return (
            <li key={item.id}>
              {item.href ? (
                <Link
                  className={active ? `${styles.navigationLink} ${styles.navigationLinkActive}` : styles.navigationLink}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ) : (
                <span className={styles.navigationDisabled} aria-disabled="true">
                  <span>{item.label}</span>
                  {status ? <span className={styles.navigationStatus}>{status}</span> : null}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
