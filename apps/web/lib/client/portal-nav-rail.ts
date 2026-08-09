export const PORTAL_NAV_RAIL_KEY = "portal-nav-rail-collapsed";

export function readPortalNavRailCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PORTAL_NAV_RAIL_KEY) === "1";
  } catch {
    return false;
  }
}

export function writePortalNavRailCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(PORTAL_NAV_RAIL_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}
