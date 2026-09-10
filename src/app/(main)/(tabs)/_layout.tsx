import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { NotificationBellIcon } from "@/components/icons/notification-bell-icon";
import { SearchInputIcon } from "@/components/icons/search-input-icon";
import { RADIUS, SPACING } from "@/constants/theme";
import { resolveAppFontFamily } from "@/lib/typography";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { useAppTheme } from "@/providers/theme-provider";

export default function MainTabsLayout() {
  const { colors, resolvedTheme } = useAppTheme();
  const { unreadCount } = useUserNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const styles = useMemo(() => createStyles(), []);
  const headerTitle = pathname === "/categories"
    ? "Categories"
    : pathname === "/favorite"
      ? "Bookmarks"
      : pathname === "/settings"
        ? "Settings"
        : "GeetKosh";
  const navigationTheme = useMemo(() => {
    const base = resolvedTheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.tabActive,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.tabActive,
      },
    };
  }, [colors, resolvedTheme]);

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
    <>
      {/* Native tabs use the enclosing stack for their navigation header. */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerBackVisible: false,
          headerTitle,
          headerTitleStyle: { fontFamily: resolveAppFontFamily("medium") },
          headerRight: pathname === "/" ? homeHeaderRight : undefined,
        }}
      />
      <ThemeProvider value={navigationTheme}>
        <NativeTabs
          backBehavior="history"
          backgroundColor={colors.surface}
          tintColor={colors.tabActive}
          iconColor={{ default: colors.tabInactive, selected: colors.tabActive }}
          labelStyle={{
            default: {
              fontFamily: resolveAppFontFamily("medium"),
              fontSize: 12,
              color: colors.tabInactive,
            },
            selected: {
              fontFamily: resolveAppFontFamily("medium"),
              fontSize: 12,
              color: colors.tabActive,
            },
          }}
          indicatorColor={`${colors.tabActive}1F`}
          rippleColor={`${colors.tabActive}14`}
          labelVisibilityMode="labeled"
          minimizeBehavior="never"
          disableTransparentOnScrollEdge
        >
          <NativeTabs.Trigger name="index" contentStyle={{ backgroundColor: colors.background }}>
            <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
            <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="categories" contentStyle={{ backgroundColor: colors.background }}>
            <NativeTabs.Trigger.Icon
              sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
              md="grid_view"
            />
            <NativeTabs.Trigger.Label>Categories</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="favorite" contentStyle={{ backgroundColor: colors.background }}>
            <NativeTabs.Trigger.Icon
              sf={{ default: "bookmark", selected: "bookmark.fill" }}
              md={{ default: "bookmark_border", selected: "bookmark" }}
            />
            <NativeTabs.Trigger.Label>Bookmarks</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="settings" contentStyle={{ backgroundColor: colors.background }}>
            <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
            <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      </ThemeProvider>
    </>
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
