import { describe, expect, it } from "vitest";
import {
  CLUB_NAVIGATION_ITEMS,
  isNavigationItemActive,
  navigationStatusLabel
} from "./navigation";

describe("Club navigation", () => {
  it("links only routes backed by real Platform behavior", () => {
    const linkedItems = CLUB_NAVIGATION_ITEMS.filter((item) => item.href);

    expect(linkedItems.map((item) => [item.id, item.href])).toEqual([
      ["club", "/club"],
      ["practice", "/"]
    ]);
    expect(CLUB_NAVIGATION_ITEMS.filter((item) => !item.href).every((item) => item.availability !== "available")).toBe(true);
  });

  it("marks exact and nested Club routes without treating Practice as a wildcard", () => {
    const club = CLUB_NAVIGATION_ITEMS[0];
    const practice = CLUB_NAVIGATION_ITEMS[1];

    expect(isNavigationItemActive(club, "/club")).toBe(true);
    expect(isNavigationItemActive(club, "/club/profile")).toBe(true);
    expect(isNavigationItemActive(practice, "/")).toBe(true);
    expect(isNavigationItemActive(practice, "/club")).toBe(false);
  });

  it("uses honest status labels for unavailable product concepts", () => {
    expect(navigationStatusLabel("available")).toBeUndefined();
    expect(navigationStatusLabel("preview")).toBe("Preview");
    expect(navigationStatusLabel("coming-soon")).toBe("Soon");
  });
});
