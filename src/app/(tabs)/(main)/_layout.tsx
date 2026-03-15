import Constants from "expo-constants";
import { useCallback, useState } from "react";
import { Tabs } from "expo-router";

import { CategoryTabIcon } from "@/components/icons/category-tab-icon";
import { FavoriteTabIcon } from "@/components/icons/favorite-tab-icon";
import {
  HeaderProfileButton,
  HeaderProfileMenu,
} from "@/components/header-profile-button";
import { HomeTabIcon } from "@/components/icons/home-tab-icon";
import { SettingsTabIcon } from "@/components/icons/settings-tab-icon";
import { COLORS } from "@/constants/theme";

export default function MainTabsLayout() {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const appName = Constants.expoConfig?.name ?? "DevGeet";
  const openAccountMenu = useCallback(() => {
    setIsAccountMenuOpen(true);
  }, []);
  const closeAccountMenu = useCallback(() => {
    setIsAccountMenuOpen(false);
  }, []);

  return (
    <>
      <Tabs
        initialRouteName="home"
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.surface },
          headerTintColor: COLORS.text,
          headerTitle: appName,
          headerShadowVisible: false,
          headerRight: () => <HeaderProfileButton onPress={openAccountMenu} />,
          tabBarActiveTintColor: COLORS.tabActive,
          tabBarInactiveTintColor: COLORS.tabInactive,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            height: 74,
            paddingTop: 8,
            paddingBottom: 8,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size, focused }) => (
              <HomeTabIcon color={color} size={size} filled={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            title: "Categories",
            tabBarIcon: ({ color, size, focused }) => (
              <CategoryTabIcon color={color} size={size} filled={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="favorite"
          options={{
            title: "Favorite",
            tabBarIcon: ({ color, size, focused }) => (
              <FavoriteTabIcon color={color} size={size} filled={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size, focused }) => (
              <SettingsTabIcon color={color} size={size} filled={focused} />
            ),
          }}
        />
      </Tabs>

      <HeaderProfileMenu
        visible={isAccountMenuOpen}
        onClose={closeAccountMenu}
      />
    </>
  );
}
