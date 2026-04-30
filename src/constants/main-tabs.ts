export const MAIN_TAB_ORDER = [
  "home",
  "categories",
  "favorite",
  "settings",
] as const;

export type MainTabName = (typeof MAIN_TAB_ORDER)[number];
