import Constants from "expo-constants";
import { useCallback, useState } from "react";
import { Tabs } from "expo-router";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Add01Icon,
  FavouriteIcon,
  Home01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";

import {
  HeaderProfileButton,
  HeaderProfileMenu,
} from "@/components/header-profile-button";
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
            tabBarIcon: ({ color, size }) => (
              <HugeiconsIcon icon={Home01Icon} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            title: "Categories",
            tabBarIcon: ({ color, size }) => (
              <HugeiconsIcon icon={Add01Icon} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="favorite"
          options={{
            title: "Favorite",
            tabBarIcon: ({ color, size }) => (
              <HugeiconsIcon icon={FavouriteIcon} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <HugeiconsIcon icon={Settings01Icon} color={color} size={size} />
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
