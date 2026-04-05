import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocalSearchParams } from "expo-router";
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

import { CategoriesTabContent } from "@/components/main-tabs/categories-tab-content";
import { FavoriteTabContent } from "@/components/main-tabs/favorite-tab-content";
import { HomeTabContent } from "@/components/main-tabs/home-tab-content";
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
  const initialIndexRef = useRef(getIndexForTab(initialTabRef.current));
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, resolvedTheme } = useAppTheme();
  const [activeTab, setActiveTab] = useState<MainTabName>(initialTabRef.current);
  const activeIndexValue = useSharedValue(initialIndexRef.current);
  const translateX = useSharedValue(-initialIndexRef.current * width);
  const gestureStartX = useSharedValue(-initialIndexRef.current * width);
  const tabBarBorderColor =
    resolvedTheme === "dark" ? colors.divider : colors.border;
  const tabBarTopPadding = 8;
  const tabBarBottomPadding = Math.max(insets.bottom, 12);
  const tabBarHeight = 58 + tabBarBottomPadding;

  const setActiveTabByIndex = useCallback(
    (nextIndex: number) => {
      const nextTab = MAIN_TAB_ORDER[nextIndex] ?? "home";

      activeTabRef.current = nextTab;
      setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
      activeIndexValue.value = nextIndex;
    },
    [activeIndexValue],
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
    const nextTabParam = normalizeTabParam(tab);

    if (!nextTabParam || nextTabParam === lastHandledTabRef.current) {
      return;
    }

    lastHandledTabRef.current = nextTabParam;
    snapToIndex(getIndexForTab(resolveTabName(nextTabParam)));
  }, [snapToIndex, tab]);

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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
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
              onPress={() => snapToIndex(getIndexForTab(item.name))}
            >
              {item.renderIcon(tintColor, isFocused)}
              <Text style={[styles.tabLabel, { color: tintColor }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
