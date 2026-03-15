import Constants from "expo-constants";
import { useCallback, useState } from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryTabIcon } from "@/components/icons/category-tab-icon";
import { SHADOWS } from "@/constants/theme";
import { FavoriteTabIcon } from "@/components/icons/favorite-tab-icon";
import {
  HeaderProfileButton,
  HeaderProfileMenu,
} from "@/components/header-profile-button";
import { HomeTabIcon } from "@/components/icons/home-tab-icon";
import { SettingsTabIcon } from "@/components/icons/settings-tab-icon";
import { useAppTheme } from "@/providers/theme-provider";

export default function MainTabsLayout() {
  const { colors, resolvedTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const appName = Constants.expoConfig?.name ?? "DevGeet";
  const tabBarActiveColor = colors.tabActive;
  const tabBarInactiveColor = colors.tabInactive;
  const tabBarBorderColor =
    resolvedTheme === "dark" ? colors.divider : colors.border;
  const tabBarTopPadding = 8;
  const tabBarBottomPadding = Math.max(insets.bottom, 12);
  const tabBarHeight = 58 + tabBarBottomPadding;
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
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitle: appName,
          headerShadowVisible: false,
          headerRight: () => <HeaderProfileButton onPress={openAccountMenu} />,
          tabBarActiveTintColor: tabBarActiveColor,
          tabBarInactiveTintColor: tabBarInactiveColor,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: tabBarBorderColor,
            height: tabBarHeight,
            paddingTop: tabBarTopPadding,
            paddingBottom: tabBarBottomPadding,
            ...SHADOWS.md,
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
