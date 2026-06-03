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
  const styles = useMemo(() => createStyles(), []);

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
          <SearchInputIcon color={colors.text} size={24} styleVariant="tab" />
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
            size={24}
            showAlertDot={unreadCount > 0}
            styleVariant="tab"
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
        headerTitleStyle: {
          fontFamily: resolveAppFontFamily("medium"),
        },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarHideOnKeyboard: true,
        tabBarButton: ({
          accessibilityHint,
          accessibilityLabel,
          accessibilityRole,
          accessibilityState,
          accessibilityValue,
          children,
          disabled,
          onLongPress,
          onPress,
          onPressIn,
          onPressOut,
          style,
          testID,
        }) => (
          <Pressable
            accessibilityHint={accessibilityHint}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole}
            accessibilityState={accessibilityState}
            accessibilityValue={accessibilityValue}
            android_ripple={{ color: "transparent", borderless: false }}
            disabled={disabled}
            onLongPress={onLongPress ?? undefined}
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={style}
            testID={testID}
          >
            {children}
          </Pressable>
        ),
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

const createStyles = () =>
  StyleSheet.create({
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: SPACING.md,
      gap: SPACING.sm,
    },
    headerActionButton: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    headerActionButtonPressed: {
      opacity: 0.72,
    },
  });
