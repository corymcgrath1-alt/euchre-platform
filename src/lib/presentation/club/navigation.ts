import type { Route } from "next";

export interface ClubNavigationItem {
  id: "club" | "practice";
  label: string;
  href: Route;
}

export const CLUB_NAVIGATION_ITEMS: readonly ClubNavigationItem[] = [
  { id: "club", label: "Club", href: "/club" as Route },
  { id: "practice", label: "Practice", href: "/" }
] as const;

export function isNavigationItemActive(item: ClubNavigationItem, pathname: string): boolean {
  if (item.href === "/") {
    return pathname === "/";
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
