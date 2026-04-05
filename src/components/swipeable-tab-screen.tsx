import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { MAIN_TAB_ORDER, MAIN_TAB_PATHS, type MainTabName } from "@/constants/main-tabs";
import { useAppTheme } from "@/providers/theme-provider";

const SWIPE_ACTIVATION_OFFSET = 14;
const SWIPE_DISTANCE_THRESHOLD_RATIO = 0.22;
const SWIPE_VELOCITY_THRESHOLD = 520;
const EDGE_RESISTANCE = 0.24;
const MAX_DRAG_RATIO = 0.72;
const RELEASE_DURATION = 220;
const RESET_SPRING = {
  damping: 24,
  stiffness: 240,
};
type SwipeDirection = "left" | "right";

type SwipeableTabScreenProps = {
  children: ReactNode;
  tabName: MainTabName;
  previousScreen?: ReactNode;
  nextScreen?: ReactNode;
};

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function getSwipeDirection(translationX: number): SwipeDirection | null {
  "worklet";

  if (translationX < 0) {
    return "left";
  }

  if (translationX > 0) {
    return "right";
  }

  return null;
}

function getAdjacentTab(
  tabName: MainTabName,
  direction: SwipeDirection,
): MainTabName | null {
  "worklet";

  const currentIndex = MAIN_TAB_ORDER.indexOf(tabName);
  const targetIndex = direction === "left" ? currentIndex + 1 : currentIndex - 1;

  return MAIN_TAB_ORDER[targetIndex] ?? null;
}

export function SwipeableTabScreen({
  children,
  previousScreen,
  nextScreen,
  tabName,
}: SwipeableTabScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const translateX = useSharedValue(0);
  const isNavigating = useSharedValue(false);
  const previewDirectionValue = useSharedValue(0);
  const [previewDirection, setPreviewDirection] = useState<SwipeDirection | null>(null);
  const hasPreviousScreen = previousScreen != null;
  const hasNextScreen = nextScreen != null;
  const setActivePreview = (direction: SwipeDirection | null) => {
    setPreviewDirection((currentDirection) =>
      currentDirection === direction ? currentDirection : direction,
    );
  };
  const clearActivePreview = () => {
    setPreviewDirection(null);
  };
  const resetToCurrentPage = () => {
    "worklet";

    translateX.value = withSpring(0, RESET_SPRING, (finished) => {
      if (!finished) {
        return;
      }

      previewDirectionValue.value = 0;
      runOnJS(clearActivePreview)();
    });
  };
  const finishNavigation = (nextTab: MainTabName) => {
    setPreviewDirection(null);
    previewDirectionValue.value = 0;
    router.navigate(MAIN_TAB_PATHS[nextTab]);
    requestAnimationFrame(() => {
      translateX.value = 0;
      isNavigating.value = false;
    });
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-SWIPE_ACTIVATION_OFFSET, SWIPE_ACTIVATION_OFFSET])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      cancelAnimation(translateX);
    })
    .onUpdate((event) => {
      if (isNavigating.value) {
        return;
      }

      const direction = getSwipeDirection(event.translationX);
      const nextTab = direction ? getAdjacentTab(tabName, direction) : null;
      const hasAdjacentScreen = nextTab != null;
      const nextPreviewDirection = hasAdjacentScreen
        ? direction
        : null;
      const safeWidth = Math.max(width, 1);
      const dampenedOffset = hasAdjacentScreen
        ? event.translationX
        : event.translationX * EDGE_RESISTANCE;
      const maxOffset =
        safeWidth * (hasAdjacentScreen ? MAX_DRAG_RATIO : EDGE_RESISTANCE);
      const nextPreviewDirectionValue =
        nextPreviewDirection === "left" ? 1 : nextPreviewDirection === "right" ? 2 : 0;

      if (previewDirectionValue.value !== nextPreviewDirectionValue) {
        previewDirectionValue.value = nextPreviewDirectionValue;
        runOnJS(setActivePreview)(nextPreviewDirection);
      }

      translateX.value = clamp(dampenedOffset, -maxOffset, maxOffset);
    })
    .onEnd((event) => {
      if (isNavigating.value) {
        return;
      }

      const direction = getSwipeDirection(event.translationX);
      const nextTab = direction ? getAdjacentTab(tabName, direction) : null;
      const hasAdjacentScreen = nextTab != null;
      const safeWidth = Math.max(width, 1);
      const passedThreshold =
        Math.abs(event.translationX) >= safeWidth * SWIPE_DISTANCE_THRESHOLD_RATIO ||
        Math.abs(event.velocityX) >= SWIPE_VELOCITY_THRESHOLD;

      if (!direction || !nextTab || !hasAdjacentScreen || !passedThreshold) {
        resetToCurrentPage();
        return;
      }

      isNavigating.value = true;
      translateX.value = withTiming(
        direction === "left" ? -safeWidth : safeWidth,
        { duration: RELEASE_DURATION },
        (finished) => {
          if (!finished) {
            translateX.value = 0;
            isNavigating.value = false;
            previewDirectionValue.value = 0;
            runOnJS(clearActivePreview)();
            return;
          }

          runOnJS(finishNavigation)(nextTab);
        },
      );
    })
    .onFinalize(() => {
      if (isNavigating.value) {
        return;
      }

      if (translateX.value !== 0) {
        resetToCurrentPage();
        return;
      }

      if (previewDirectionValue.value !== 0) {
        previewDirectionValue.value = 0;
        runOnJS(clearActivePreview)();
      }
    });

  const currentPageStyle = useAnimatedStyle(() => {
    const safeWidth = Math.max(width, 1);
    const distance = Math.abs(translateX.value);

    return {
      transform: [
        { translateX: translateX.value },
        {
          scale: interpolate(
            distance,
            [0, safeWidth],
            [1, 0.992],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const previousPageStyle = useAnimatedStyle(() => ({
    opacity: hasPreviousScreen
      ? interpolate(translateX.value, [0, width * 0.25, width], [0.18, 0.75, 1], Extrapolation.CLAMP)
      : 0,
    transform: [{ translateX: -width + translateX.value }],
  }));

  const nextPageStyle = useAnimatedStyle(() => ({
    opacity: hasNextScreen
      ? interpolate(-translateX.value, [0, width * 0.25, width], [0.18, 0.75, 1], Extrapolation.CLAMP)
      : 0,
    transform: [{ translateX: width + translateX.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {previewDirection === "right" && hasPreviousScreen ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.page, previousPageStyle]}
        >
          {previousScreen}
        </Animated.View>
      ) : null}

      {previewDirection === "left" && hasNextScreen ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.page, nextPageStyle]}
        >
          {nextScreen}
        </Animated.View>
      ) : null}

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.page, currentPageStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  page: {
    ...StyleSheet.absoluteFillObject,
  },
});
