export const MAIN_TAB_ORDER = [
  "home",
  "categories",
  "favorite",
  "settings",
] as const;

export type MainTabName = (typeof MAIN_TAB_ORDER)[number];

export const MAIN_TAB_PATHS = {
  home: "/(tabs)/(main)/home",
  categories: "/(tabs)/(main)/categories",
  favorite: "/(tabs)/(main)/favorite",
  settings: "/(tabs)/(main)/settings",
} as const satisfies Record<MainTabName, string>;
