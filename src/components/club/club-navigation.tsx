"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CLUB_NAVIGATION_ITEMS,
  isNavigationItemActive
} from "@/lib/presentation/club/navigation";
import styles from "./club-app-frame.module.css";

export function ClubNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.navigation} aria-label="Primary navigation">
      <ul className={styles.navigationList}>
        {CLUB_NAVIGATION_ITEMS.map((item) => {
          const active = isNavigationItemActive(item, pathname);

          return (
            <li key={item.id}>
              <Link
                className={active ? `${styles.navigationLink} ${styles.navigationLinkActive}` : styles.navigationLink}
                href={item.href}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
