import Constants from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeaderNotificationsButton } from "@/components/header-notifications";
import { HeaderProfileButton } from "@/components/header-profile-button";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { MainTabsHeaderContext } from "@/components/main-tabs/main-tabs-header-context";
import {
  MAIN_TAB_DEFINITIONS,
  getMainTabIndex,
  normalizeMainTabParam,
  resolveMainTabName,
} from "@/components/main-tabs/main-tabs-config";
import { MAIN_TAB_ORDER, type MainTabName } from "@/constants/main-tabs";
import { SHADOWS, SPACING } from "@/constants/theme";
import { resolveAppFontFamily, resolveProductFontFamily } from "@/lib/typography";
import { useAppTheme } from "@/providers/theme-provider";

const SWIPE_ACTIVATION_OFFSET = 14;
const SWIPE_DISTANCE_THRESHOLD_RATIO = 0.22;
const SWIPE_VELOCITY_THRESHOLD = 520;
const EDGE_RESISTANCE = 0.24;
const RELEASE_DURATION = 220;
const HEADER_ROW_HEIGHT = 56;
const HEADER_SHADOW_SCROLL_THRESHOLD = 4;

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

export function MainTabsShell() {
  const { tab } = useLocalSearchParams<{ tab?: string | string[] }>();
  const initialTabRef = useRef(resolveMainTabName(tab));
  const lastHandledTabRef = useRef<string | undefined>(normalizeMainTabParam(tab));
  const activeTabRef = useRef<MainTabName>(initialTabRef.current);
  const tabScrollOffsetsRef = useRef<Record<MainTabName, number>>({
    home: 0,
    categories: 0,
    favorite: 0,
    settings: 0,
  });
  const headerHiddenByTabRef = useRef<Record<MainTabName, boolean>>({
    home: false,
    categories: false,
    favorite: false,
    settings: false,
  });
  const tabBarHiddenByTabRef = useRef<Record<MainTabName, boolean>>({
    home: false,
    categories: false,
    favorite: false,
    settings: false,
  });
  const initialIndexRef = useRef(getMainTabIndex(initialTabRef.current));
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { unreadCount: unreadNotificationsCount } = useUserNotifications({
    category: "all",
  });
  const { colors, resolvedTheme } = useAppTheme();
  const [activeTab, setActiveTab] = useState<MainTabName>(initialTabRef.current);
  const [isHeaderElevated, setIsHeaderElevated] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [isTabBarHidden, setIsTabBarHidden] = useState(false);
  const activeIndexValue = useSharedValue(initialIndexRef.current);
  const translateX = useSharedValue(-initialIndexRef.current * width);
  const gestureStartX = useSharedValue(-initialIndexRef.current * width);
  const headerElevationRef = useRef(false);
  const tabBarBorderColor =
    resolvedTheme === "dark" ? colors.divider : colors.border;
  const tabBarTopPadding = 8;
  const tabBarBottomPadding = Math.max(insets.bottom, 12);
  const tabBarHeight = 58 + tabBarBottomPadding;
  const appName = Constants.expoConfig?.name ?? "DevGeet";
  const activeTabItem = MAIN_TAB_DEFINITIONS.find((item) => item.name === activeTab);
  const activeTabLabel = activeTabItem ? activeTabItem.label : appName;
  const headerTitleText = activeTab === "home" ? appName : activeTabLabel;
  const headerBackgroundColor = activeTab === "home" ? colors.surface : colors.background;
  const homeHeaderIconBackgroundColor = activeTab === "home" ? colors.surfaceMuted : undefined;
  const showHomeHeaderActions = activeTab === "home";
  const showProfileHeaderAction = activeTab !== "settings";

  const setHeaderElevation = useCallback((nextValue: boolean) => {
    if (headerElevationRef.current === nextValue) {
      return;
    }

    headerElevationRef.current = nextValue;
    setIsHeaderElevated(nextValue);
  }, []);

  const syncHeaderHiddenForTab = useCallback((tabName: MainTabName) => {
    const nextValue = Boolean(headerHiddenByTabRef.current[tabName]);
    setIsHeaderHidden((currentValue) =>
      currentValue === nextValue ? currentValue : nextValue,
    );
  }, []);

  const setHeaderHidden = useCallback((tabName: MainTabName, hidden: boolean) => {
    const nextHiddenValue = Boolean(hidden);

    if (headerHiddenByTabRef.current[tabName] === nextHiddenValue) {
      return;
    }

    headerHiddenByTabRef.current[tabName] = nextHiddenValue;

    if (tabName !== activeTabRef.current) {
      return;
    }

    setIsHeaderHidden(nextHiddenValue);

    if (nextHiddenValue) {
      setHeaderElevation(false);
    } else {
      const tabOffset = Math.max(tabScrollOffsetsRef.current[tabName] ?? 0, 0);
      setHeaderElevation(tabOffset > HEADER_SHADOW_SCROLL_THRESHOLD);
    }
  }, [setHeaderElevation]);

  const syncTabBarHiddenForTab = useCallback((tabName: MainTabName) => {
    const nextValue = Boolean(tabBarHiddenByTabRef.current[tabName]);
    setIsTabBarHidden((currentValue) =>
      currentValue === nextValue ? currentValue : nextValue,
    );
  }, []);

  const setTabBarHidden = useCallback((tabName: MainTabName, hidden: boolean) => {
    const nextHiddenValue = Boolean(hidden);

    if (tabBarHiddenByTabRef.current[tabName] === nextHiddenValue) {
      return;
    }

    tabBarHiddenByTabRef.current[tabName] = nextHiddenValue;

    if (tabName !== activeTabRef.current) {
      return;
    }

    setIsTabBarHidden(nextHiddenValue);
  }, []);

  const syncHeaderStateForTab = useCallback(
    (tabName: MainTabName) => {
      if (headerHiddenByTabRef.current[tabName]) {
        setHeaderElevation(false);
        return;
      }

      const tabOffset = Math.max(tabScrollOffsetsRef.current[tabName] ?? 0, 0);
      setHeaderElevation(tabOffset > HEADER_SHADOW_SCROLL_THRESHOLD);
    },
    [setHeaderElevation],
  );

  const reportScrollOffset = useCallback(
    (tabName: MainTabName, offsetY: number) => {
      const nextOffsetY = Math.max(offsetY, 0);
      tabScrollOffsetsRef.current[tabName] = nextOffsetY;

      if (tabName !== activeTabRef.current) {
        return;
      }

      if (headerHiddenByTabRef.current[tabName]) {
        setHeaderElevation(false);
        return;
      }

      setHeaderElevation(nextOffsetY > HEADER_SHADOW_SCROLL_THRESHOLD);
    },
    [setHeaderElevation],
  );

  const setActiveTabByIndex = useCallback(
    (nextIndex: number) => {
      const nextTab = MAIN_TAB_ORDER[nextIndex] ?? "home";

      activeTabRef.current = nextTab;
      setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
      activeIndexValue.value = nextIndex;
      syncHeaderHiddenForTab(nextTab);
      syncHeaderStateForTab(nextTab);
      syncTabBarHiddenForTab(nextTab);
    },
    [activeIndexValue, syncHeaderHiddenForTab, syncHeaderStateForTab, syncTabBarHiddenForTab],
  );

  const snapToIndex = useCallback(
    (nextIndex: number, animated = true) => {
      const clampedIndex = Math.max(0, Math.min(nextIndex, MAIN_TAB_ORDER.length - 1));
      const targetTranslateX = -clampedIndex * width;

      setActiveTabByIndex(clampedIndex);

      if (!animated) {
        translateX.value = targetTranslateX;
        return;
      }

      translateX.value = withTiming(targetTranslateX, {
        duration: RELEASE_DURATION,
      });
    },
    [setActiveTabByIndex, translateX, width],
  );

  useEffect(() => {
    translateX.value = -getMainTabIndex(activeTabRef.current) * width;
  }, [translateX, width]);

  useEffect(() => {
    syncHeaderHiddenForTab(activeTabRef.current);
    syncHeaderStateForTab(activeTabRef.current);
    syncTabBarHiddenForTab(activeTabRef.current);
  }, [syncHeaderHiddenForTab, syncHeaderStateForTab, syncTabBarHiddenForTab]);

  useEffect(() => {
    const nextTabParam = normalizeMainTabParam(tab);

    if (!nextTabParam || nextTabParam === lastHandledTabRef.current) {
      return;
    }

    lastHandledTabRef.current = nextTabParam;
    snapToIndex(getMainTabIndex(resolveMainTabName(nextTabParam)));
  }, [snapToIndex, tab]);

  const openProfilePage = useCallback(() => {
    router.push("/profile");
  }, [router]);

  const openNotificationsPage = useCallback(() => {
    router.push("/notifications");
  }, [router]);

  const handleTabPress = useCallback(
    (tabName: MainTabName) => {
      snapToIndex(getMainTabIndex(tabName), false);
    },
    [snapToIndex],
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-SWIPE_ACTIVATION_OFFSET, SWIPE_ACTIVATION_OFFSET])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      cancelAnimation(translateX);
      gestureStartX.value = translateX.value;
    })
    .onUpdate((event) => {
      const minTranslateX = -(MAIN_TAB_ORDER.length - 1) * width;
      const maxTranslateX = 0;
      const nextTranslateX = gestureStartX.value + event.translationX;

      if (nextTranslateX > maxTranslateX) {
        translateX.value =
          maxTranslateX + (nextTranslateX - maxTranslateX) * EDGE_RESISTANCE;
        return;
      }

      if (nextTranslateX < minTranslateX) {
        translateX.value =
          minTranslateX + (nextTranslateX - minTranslateX) * EDGE_RESISTANCE;
        return;
      }

      translateX.value = clamp(nextTranslateX, minTranslateX, maxTranslateX);
    })
    .onEnd((event) => {
      const currentIndex = activeIndexValue.value;
      const passedThreshold =
        Math.abs(event.translationX) >= width * SWIPE_DISTANCE_THRESHOLD_RATIO ||
        Math.abs(event.velocityX) >= SWIPE_VELOCITY_THRESHOLD;

      if (!passedThreshold) {
        translateX.value = withTiming(-currentIndex * width, {
          duration: RELEASE_DURATION,
        });
        return;
      }

      const direction = event.translationX < 0 ? 1 : -1;
      const nextIndex = Math.max(
        0,
        Math.min(currentIndex + direction, MAIN_TAB_ORDER.length - 1),
      );

      runOnJS(setActiveTabByIndex)(nextIndex);
      translateX.value = withTiming(-nextIndex * width, {
        duration: RELEASE_DURATION,
      });
    });

  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <MainTabsHeaderContext.Provider value={{ reportScrollOffset, setHeaderHidden, setTabBarHidden }}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.headerSurface,
            isHeaderElevated && styles.headerSurfaceElevated,
            {
              backgroundColor: headerBackgroundColor,
              borderBottomWidth: isHeaderElevated ? StyleSheet.hairlineWidth : 0,
              borderBottomColor: tabBarBorderColor,
            },
          ]}
        >
          <View
            style={[
              {
                height: insets.top,
                backgroundColor: headerBackgroundColor,
              },
            ]}
          />
          <View
            style={[
              styles.headerContainer,
              {
                backgroundColor: headerBackgroundColor,
                height: isHeaderHidden ? 0 : HEADER_ROW_HEIGHT,
              },
            ]}
          >
            {!isHeaderHidden ? (
              <View style={styles.headerContent}>
                <View style={styles.headerRow}>
                  <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                    {headerTitleText}
                  </Text>
                  {showHomeHeaderActions || showProfileHeaderAction ? (
                    <View style={styles.headerActions}>
                      {showHomeHeaderActions ? (
                        <>
                          <HeaderNotificationsButton
                            unreadCount={unreadNotificationsCount}
                            onPress={openNotificationsPage}
                            backgroundColor={homeHeaderIconBackgroundColor}
                            badgeMode="dot"
                            accessibilityLabel={
                              unreadNotificationsCount
                                ? `Open notifications. ${unreadNotificationsCount} unread notifications`
                                : "Open notifications"
                            }
                          />
                        </>
                      ) : null}
                      {showProfileHeaderAction ? (
                        <HeaderProfileButton
                          onPress={openProfilePage}
                          backgroundColor={homeHeaderIconBackgroundColor}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.pagerViewport}>
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.pagerTrack,
                { width: width * MAIN_TAB_ORDER.length },
                pagerStyle,
              ]}
            >
              {MAIN_TAB_DEFINITIONS.map(({ name, Content }) => (
                <View key={name} style={[styles.page, { width }]}>
                  <Content />
                </View>
              ))}
            </Animated.View>
          </GestureDetector>
        </View>

        {!isTabBarHidden ? (
          <View
            style={[
              styles.tabBar,
              {
                backgroundColor: colors.surface,
                borderTopColor: tabBarBorderColor,
                height: tabBarHeight,
                paddingTop: tabBarTopPadding,
                paddingBottom: tabBarBottomPadding,
              },
            ]}
          >
            {MAIN_TAB_DEFINITIONS.map((item) => {
              const isFocused = item.name === activeTab;
              const tintColor = isFocused ? colors.tabActive : colors.tabInactive;

              return (
                <Pressable
                  key={item.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFocused }}
                  style={({ pressed }) => [
                    styles.tabButton,
                    pressed && styles.tabButtonPressed,
                  ]}
                  onPress={() => handleTabPress(item.name)}
                >
                  {item.renderIcon(tintColor, isFocused)}
                  <Text numberOfLines={1} style={[styles.tabLabel, { color: tintColor }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </MainTabsHeaderContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  statusBarFill: {
  },
  headerSurface: {
    zIndex: 2,
  },
  headerSurfaceElevated: {
    shadowColor: "#00000024",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  headerContainer: {
    overflow: "hidden",
  },
  headerContent: {
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  headerRow: {
    minHeight: HEADER_ROW_HEIGHT - SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    fontFamily: resolveProductFontFamily("bold"),
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pagerViewport: {
    flex: 1,
    overflow: "hidden",
  },
  pagerTrack: {
    flex: 1,
    flexDirection: "row",
  },
  page: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    ...SHADOWS.md,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: "100%",
    paddingHorizontal: SPACING.sm,
  },
  tabButtonPressed: {
    opacity: 0.82,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
    fontFamily: resolveAppFontFamily("medium"),
  },
});
