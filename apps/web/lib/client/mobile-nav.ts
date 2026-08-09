/** Estado do menu mobile (drawer) - partilhado com NexiGuia e shells. */

export const MOBILE_NAV_EVENT = "nexiforma:mobile-nav";

export type MobileNavDetail = { open: boolean };

export function publishMobileNavOpen(open: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.mobileNavOpen = open ? "1" : "0";
  window.dispatchEvent(
    new CustomEvent<MobileNavDetail>(MOBILE_NAV_EVENT, { detail: { open } }),
  );
}

export function readMobileNavOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.mobileNavOpen === "1";
}
