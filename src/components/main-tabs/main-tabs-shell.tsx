import Constants from "expo-constants";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

import {
  HeaderNotificationsButton,
  useHeaderNotifications,
} from "@/components/header-notifications";
import {
  HeaderProfileButton,
  HeaderProfileMenu,
} from "@/components/header-profile-button";
import { CategoriesTabContent } from "@/components/main-tabs/categories-tab-content";
import { FavoriteTabContent } from "@/components/main-tabs/favorite-tab-content";
import { HomeTabContent } from "@/components/main-tabs/home-tab-content";
import { MainTabsHeaderContext } from "@/components/main-tabs/main-tabs-header-context";
import { SettingsTabContent } from "@/components/main-tabs/settings-tab-content";
import { CategoryTabIcon } from "@/components/icons/category-tab-icon";
import { FavoriteTabIcon } from "@/components/icons/favorite-tab-icon";
import { HomeTabIcon } from "@/components/icons/home-tab-icon";
import { SettingsTabIcon } from "@/components/icons/settings-tab-icon";
import { MAIN_TAB_ORDER, type MainTabName } from "@/constants/main-tabs";
import { SHADOWS, SPACING } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

const SWIPE_ACTIVATION_OFFSET = 14;
const SWIPE_DISTANCE_THRESHOLD_RATIO = 0.22;
const SWIPE_VELOCITY_THRESHOLD = 520;
const EDGE_RESISTANCE = 0.24;
const RELEASE_DURATION = 220;
const HEADER_ANIMATION_DURATION = 220;
const HEADER_ROW_HEIGHT = 56;
const HEADER_HIDE_SCROLL_THRESHOLD = 48;
const HEADER_SHOW_SCROLL_THRESHOLD = 12;
const HEADER_DIRECTION_THRESHOLD = 6;

const TAB_ITEMS = [
  {
    name: "home",
    label: "Home",
    renderIcon: (color: string, focused: boolean) => (
      <HomeTabIcon color={color} size={24} filled={focused} />
    ),
  },
  {
    name: "categories",
    label: "Categories",
    renderIcon: (color: string, focused: boolean) => (
      <CategoryTabIcon color={color} size={24} filled={focused} />
    ),
  },
  {
    name: "favorite",
    label: "Favorite",
    renderIcon: (color: string, focused: boolean) => (
      <FavoriteTabIcon color={color} size={24} filled={focused} />
    ),
  },
  {
    name: "settings",
    label: "Settings",
    renderIcon: (color: string, focused: boolean) => (
      <SettingsTabIcon color={color} size={24} filled={focused} />
    ),
  },
] as const satisfies readonly {
  name: MainTabName;
  label: string;
  renderIcon: (color: string, focused: boolean) => ReactNode;
}[];

const TAB_CONTENT: Record<MainTabName, ReactNode> = {
  home: <HomeTabContent />,
  categories: <CategoriesTabContent />,
  favorite: <FavoriteTabContent />,
  settings: <SettingsTabContent />,
};

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function getIndexForTab(tabName: MainTabName) {
  return MAIN_TAB_ORDER.indexOf(tabName);
}

function normalizeTabParam(tabParam: string | string[] | undefined) {
  if (Array.isArray(tabParam)) {
    return tabParam[0];
  }

  return tabParam;
}

function resolveTabName(tabParam: string | string[] | undefined): MainTabName {
  const normalizedTab = normalizeTabParam(tabParam);

  if (!normalizedTab) {
    return "home";
  }

  return MAIN_TAB_ORDER.find((tabName) => tabName === normalizedTab) ?? "home";
}

export function MainTabsShell() {
  const { tab } = useLocalSearchParams<{ tab?: string | string[] }>();
  const initialTabRef = useRef(resolveTabName(tab));
  const lastHandledTabRef = useRef<string | undefined>(normalizeTabParam(tab));
  const activeTabRef = useRef<MainTabName>(initialTabRef.current);
  const tabScrollOffsetsRef = useRef<Record<MainTabName, number>>({
    home: 0,
    categories: 0,
    favorite: 0,
    settings: 0,
  });
  const initialIndexRef = useRef(getIndexForTab(initialTabRef.current));
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, resolvedTheme } = useAppTheme();
  const { unreadCount } = useHeaderNotifications();
  const [activeTab, setActiveTab] = useState<MainTabName>(initialTabRef.current);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const activeIndexValue = useSharedValue(initialIndexRef.current);
  const translateX = useSharedValue(-initialIndexRef.current * width);
  const gestureStartX = useSharedValue(-initialIndexRef.current * width);
  const headerRowOffset = useSharedValue(0);
  const headerTargetRef = useRef(0);
  const tabBarBorderColor =
    resolvedTheme === "dark" ? colors.divider : colors.border;
  const tabBarTopPadding = 8;
  const tabBarBottomPadding = Math.max(insets.bottom, 12);
  const tabBarHeight = 58 + tabBarBottomPadding;
  const appName = Constants.expoConfig?.name ?? "DevGeet";
  const activeTabLabel =
    TAB_ITEMS.find((item) => item.name === activeTab)?.label ?? appName;
  const headerTitleText = activeTab === "home" ? appName : activeTabLabel;

  const setHeaderTarget = useCallback(
    (nextTarget: number, animated = true) => {
      if (headerTargetRef.current === nextTarget) {
        return;
      }

      headerTargetRef.current = nextTarget;

      if (animated) {
        headerRowOffset.value = withTiming(nextTarget, {
          duration: HEADER_ANIMATION_DURATION,
        });
        return;
      }

      headerRowOffset.value = nextTarget;
    },
    [headerRowOffset],
  );

  const syncHeaderOffsetForTab = useCallback(
    (tabName: MainTabName, animated = false) => {
      const tabOffset = Math.max(tabScrollOffsetsRef.current[tabName] ?? 0, 0);
      const nextTarget =
        tabOffset > HEADER_HIDE_SCROLL_THRESHOLD ? HEADER_ROW_HEIGHT : 0;

      setHeaderTarget(nextTarget, animated);
    },
    [setHeaderTarget],
  );

  const reportScrollOffset = useCallback(
    (tabName: MainTabName, offsetY: number) => {
      const nextOffsetY = Math.max(offsetY, 0);
      const previousOffsetY = tabScrollOffsetsRef.current[tabName] ?? 0;
      tabScrollOffsetsRef.current[tabName] = nextOffsetY;

      if (tabName !== activeTabRef.current) {
        return;
      }

      if (nextOffsetY <= HEADER_SHOW_SCROLL_THRESHOLD) {
        setHeaderTarget(0);
        return;
      }

      const deltaY = nextOffsetY - previousOffsetY;

      if (
        deltaY >= HEADER_DIRECTION_THRESHOLD &&
        nextOffsetY > HEADER_HIDE_SCROLL_THRESHOLD
      ) {
        setHeaderTarget(HEADER_ROW_HEIGHT);
        return;
      }

      if (deltaY <= -HEADER_DIRECTION_THRESHOLD) {
        setHeaderTarget(0);
      }
    },
    [setHeaderTarget],
  );

  const setActiveTabByIndex = useCallback(
    (nextIndex: number) => {
      const nextTab = MAIN_TAB_ORDER[nextIndex] ?? "home";

      activeTabRef.current = nextTab;
      setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
      activeIndexValue.value = nextIndex;
      syncHeaderOffsetForTab(nextTab, true);
    },
    [activeIndexValue, syncHeaderOffsetForTab],
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
    translateX.value = -getIndexForTab(activeTabRef.current) * width;
  }, [translateX, width]);

  useEffect(() => {
    syncHeaderOffsetForTab(activeTabRef.current, false);
  }, [syncHeaderOffsetForTab]);

  useEffect(() => {
    const nextTabParam = normalizeTabParam(tab);

    if (!nextTabParam || nextTabParam === lastHandledTabRef.current) {
      return;
    }

    lastHandledTabRef.current = nextTabParam;
    snapToIndex(getIndexForTab(resolveTabName(nextTabParam)));
  }, [snapToIndex, tab]);

  const openNotificationsPage = useCallback(() => {
    setIsAccountMenuOpen(false);
    router.push("/notifications");
  }, [router]);

  const openAccountMenu = useCallback(() => {
    setIsAccountMenuOpen(true);
  }, []);

  const closeAccountMenu = useCallback(() => {
    setIsAccountMenuOpen(false);
  }, []);

  const handleTabPress = useCallback(
    (tabName: MainTabName) => {
      snapToIndex(getIndexForTab(tabName), false);
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

  const headerContainerStyle = useAnimatedStyle(() => ({
    height: Math.max(HEADER_ROW_HEIGHT - headerRowOffset.value, 0),
    opacity: HEADER_ROW_HEIGHT ? 1 - headerRowOffset.value / HEADER_ROW_HEIGHT : 1,
  }));

  const headerContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -headerRowOffset.value }],
  }));

  return (
    <MainTabsHeaderContext.Provider value={{ reportScrollOffset }}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.statusBarFill,
            {
              height: insets.top,
              backgroundColor: colors.surface,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.headerContainer,
            {
              backgroundColor: colors.surface,
              borderBottomColor: tabBarBorderColor,
            },
            headerContainerStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.headerContent,
              {
                height: HEADER_ROW_HEIGHT,
              },
              headerContentStyle,
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {headerTitleText}
              </Text>
              <View style={styles.headerActions}>
                <HeaderNotificationsButton
                  unreadCount={unreadCount}
                  onPress={openNotificationsPage}
                />
                <HeaderProfileButton onPress={openAccountMenu} />
              </View>
            </View>
          </Animated.View>
        </Animated.View>

        <View style={styles.pagerViewport}>
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.pagerTrack,
                { width: width * MAIN_TAB_ORDER.length },
                pagerStyle,
              ]}
            >
              {MAIN_TAB_ORDER.map((tabName) => (
                <View key={tabName} style={[styles.page, { width }]}>
                  {TAB_CONTENT[tabName]}
                </View>
              ))}
            </Animated.View>
          </GestureDetector>
        </View>

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
          {TAB_ITEMS.map((item) => {
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
                <Text style={[styles.tabLabel, { color: tintColor }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <HeaderProfileMenu
          visible={isAccountMenuOpen}
          onClose={closeAccountMenu}
        />
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
  headerContainer: {
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    fontSize: 22,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "600",
  },
});
