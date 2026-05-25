import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Tabs, useRouter } from "expo-router";

import { CategoryTabIcon } from "@/components/icons/category-tab-icon";
import { FavoriteTabIcon } from "@/components/icons/favorite-tab-icon";
import { HomeTabIcon } from "@/components/icons/home-tab-icon";
import { NotificationBellIcon } from "@/components/icons/notification-bell-icon";
import { SearchInputIcon } from "@/components/icons/search-input-icon";
import { SettingsTabIcon } from "@/components/icons/settings-tab-icon";
import { RADIUS, SPACING } from "@/constants/theme";
import { resolveAppFontFamily } from "@/lib/typography";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { useAppTheme } from "@/providers/theme-provider";

export default function MainTabsLayout() {
  const { colors, resolvedTheme } = useAppTheme();
  const { unreadCount } = useUserNotifications();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors.text), [colors.text]);

  const openSearch = useCallback(() => {
    router.push("/(main)/search");
  }, [router]);

  const openNotifications = useCallback(() => {
    router.push("/(main)/notifications");
  }, [router]);

  const homeHeaderRight = useCallback(
    () => (
      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open search"
          hitSlop={6}
          onPress={openSearch}
          style={({ pressed }) => [
            styles.headerActionButton,
            pressed ? styles.headerActionButtonPressed : null,
          ]}
        >
          <SearchInputIcon color={colors.text} size={20} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          hitSlop={6}
          onPress={openNotifications}
          style={({ pressed }) => [
            styles.headerActionButton,
            pressed ? styles.headerActionButtonPressed : null,
          ]}
        >
          <NotificationBellIcon
            color={colors.text}
            size={20}
            showAlertDot={unreadCount > 0}
          />
        </Pressable>
      </View>
    ),
    [colors.text, openNotifications, openSearch, styles, unreadCount],
  );

  return (
    <Tabs
      backBehavior="history"
      initialRouteName="index"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarHideOnKeyboard: true,
        tabBarPressColor: "transparent",
        tabBarPressOpacity: 1,
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          fontFamily: resolveAppFontFamily("medium"),
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: resolvedTheme === "dark" ? colors.divider : colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: "Home",
          headerTitle: "DevGeet",
          headerRight: homeHeaderRight,
          tabBarIcon: ({ color, focused }) => (
            <HomeTabIcon color={color} size={24} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
          tabBarIcon: ({ color, focused }) => (
            <CategoryTabIcon color={color} size={24} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorite"
        options={{
          title: "Bookmarks",
          tabBarIcon: ({ color, focused }) => (
            <FavoriteTabIcon color={color} size={24} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <SettingsTabIcon color={color} size={24} filled={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (iconColor: string) =>
  StyleSheet.create({
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: SPACING.sm,
      gap: SPACING.xs,
    },
    headerActionButton: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${iconColor}30`,
    },
    headerActionButtonPressed: {
      opacity: 0.72,
    },
  });
