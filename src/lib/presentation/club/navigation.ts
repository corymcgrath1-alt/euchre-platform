import type { Route } from "next";

export type ClubNavigationAvailability = "available" | "preview" | "coming-soon";

export interface ClubNavigationItem {
  id: "club" | "practice" | "ranked" | "replays" | "tournaments" | "decks";
  label: string;
  availability: ClubNavigationAvailability;
  href?: Route;
}

export const CLUB_NAVIGATION_ITEMS: readonly ClubNavigationItem[] = [
  { id: "club", label: "Club", href: "/club" as Route, availability: "available" },
  { id: "practice", label: "Practice", href: "/", availability: "available" },
  { id: "ranked", label: "Ranked Solo", availability: "preview" },
  { id: "replays", label: "Replays", availability: "coming-soon" },
  { id: "tournaments", label: "Tournaments", availability: "coming-soon" },
  { id: "decks", label: "Decks", availability: "coming-soon" }
] as const;

export function navigationStatusLabel(availability: ClubNavigationAvailability): string | undefined {
  if (availability === "preview") {
    return "Preview";
  }

  if (availability === "coming-soon") {
    return "Soon";
  }

  return undefined;
}

export function isNavigationItemActive(item: ClubNavigationItem, pathname: string): boolean {
  if (!item.href) {
    return false;
  }

  if (item.href === "/") {
    return pathname === "/";
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
