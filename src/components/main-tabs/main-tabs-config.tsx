import type { ComponentType, ReactNode } from "react";

import { CategoryTabIcon } from "@/components/icons/category-tab-icon";
import { FavoriteTabIcon } from "@/components/icons/favorite-tab-icon";
import { HomeTabIcon } from "@/components/icons/home-tab-icon";
import { SettingsTabIcon } from "@/components/icons/settings-tab-icon";
import { SubscribeTabIcon } from "@/components/icons/subscribe-tab-icon";
import { CategoriesTabContent } from "@/components/main-tabs/categories-tab-content";
import { FavoriteTabContent } from "@/components/main-tabs/favorite-tab-content";
import { HomeTabContent } from "@/components/main-tabs/home-tab-content";
import { SettingsTabContent } from "@/components/main-tabs/settings-tab-content";
import { SubscribeTabContent } from "@/components/main-tabs/subscribe-tab-content";
import { MAIN_TAB_ORDER, type MainTabName } from "@/constants/main-tabs";

type MainTabContentComponent = ComponentType<Record<string, never>>;

export type MainTabDefinition = {
  name: MainTabName;
  label: string;
  Content: MainTabContentComponent;
  renderIcon: (color: string, focused: boolean) => ReactNode;
};

export const MAIN_TAB_DEFINITIONS = [
  {
    name: "home",
    label: "Home",
    Content: HomeTabContent,
    renderIcon: (color: string, focused: boolean) => (
      <HomeTabIcon color={color} size={24} filled={focused} />
    ),
  },
  {
    name: "categories",
    label: "Categories",
    Content: CategoriesTabContent,
    renderIcon: (color: string, focused: boolean) => (
      <CategoryTabIcon color={color} size={24} filled={focused} />
    ),
  },
  {
    name: "favorite",
    label: "Bookmarks",
    Content: FavoriteTabContent,
    renderIcon: (color: string, focused: boolean) => (
      <FavoriteTabIcon color={color} size={24} filled={focused} />
    ),
  },
  {
    name: "subscribe",
    label: "Subscribe",
    Content: SubscribeTabContent,
    renderIcon: (color: string, focused: boolean) => (
      <SubscribeTabIcon color={color} size={24} filled={focused} />
    ),
  },
  {
    name: "settings",
    label: "Settings",
    Content: SettingsTabContent,
    renderIcon: (color: string, focused: boolean) => (
      <SettingsTabIcon color={color} size={24} filled={focused} />
    ),
  },
] as const satisfies readonly MainTabDefinition[];

export const getMainTabIndex = (tabName: MainTabName) => MAIN_TAB_ORDER.indexOf(tabName);

export const normalizeMainTabParam = (tabParam: string | string[] | undefined) => {
  if (Array.isArray(tabParam)) {
    return tabParam[0];
  }

  return tabParam;
};

export const isMainTabName = (value: string): value is MainTabName =>
  MAIN_TAB_ORDER.includes(value as MainTabName);

export const resolveMainTabName = (
  tabParam: string | string[] | undefined,
): MainTabName => {
  const normalizedTab = normalizeMainTabParam(tabParam);

  if (!normalizedTab || !isMainTabName(normalizedTab)) {
    return "home";
  }

  return normalizedTab;
};
