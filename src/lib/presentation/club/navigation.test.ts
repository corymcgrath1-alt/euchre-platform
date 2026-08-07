import { describe, expect, it } from "vitest";
import {
  CLUB_NAVIGATION_ITEMS,
  isNavigationItemActive
} from "./navigation";

describe("Club navigation", () => {
  it("links only routes backed by real Platform behavior", () => {
    expect(CLUB_NAVIGATION_ITEMS.map((item) => [item.id, item.href])).toEqual([
      ["club", "/club"],
      ["practice", "/"]
    ]);
  });

  it("marks exact and nested Club routes without treating Practice as a wildcard", () => {
    const club = CLUB_NAVIGATION_ITEMS[0];
    const practice = CLUB_NAVIGATION_ITEMS[1];

    expect(isNavigationItemActive(club, "/club")).toBe(true);
    expect(isNavigationItemActive(club, "/club/profile")).toBe(true);
    expect(isNavigationItemActive(practice, "/")).toBe(true);
    expect(isNavigationItemActive(practice, "/club")).toBe(false);
  });
});
