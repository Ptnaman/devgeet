import { useEffect, useRef } from "react";
import { useSegments } from "expo-router";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

const SHOW_OPACITY_DURATION_MS = 170;
const HIDE_DURATION_MS = 240;
const HIDDEN_OFFSET = 28;
const TAB_BAR_CLEARANCE = 84;
const SCREEN_BOTTOM_CLEARANCE = 24;

type NetworkStatusToastProps = {
  message: string;
  toastKey: number;
  visible: boolean;
};

export function NetworkStatusToast({
  message,
  toastKey,
  visible,
}: NetworkStatusToastProps) {
  const { colors } = useAppTheme();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const hasBottomTabs = segments[0] === "(tabs)" && segments[1] === "(main)";
  const styles = createStyles(colors, insets.bottom, hasBottomTabs);
  const translateY = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [opacity, translateY]);

  useEffect(() => {
    opacity.stopAnimation();
    translateY.stopAnimation();

    if (visible) {
      opacity.setValue(0);
      translateY.setValue(HIDDEN_OFFSET);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: SHOW_OPACITY_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          mass: 0.9,
          stiffness: 210,
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: HIDE_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: HIDDEN_OFFSET,
        duration: HIDE_DURATION_MS,
        easing: Easing.bezier(0.22, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, toastKey, translateY, visible]);

  return (
    <View pointerEvents="none" style={styles.portal}>
      <Animated.View
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={styles.title}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  insetBottom: number,
  hasBottomTabs: boolean,
) =>
  StyleSheet.create({
    portal: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: hasBottomTabs
        ? Math.max(insetBottom + TAB_BAR_CLEARANCE, SPACING.xxl * 2)
        : Math.max(insetBottom + SCREEN_BOTTOM_CLEARANCE, SPACING.xl),
      zIndex: 20,
      alignItems: "center",
    },
    toast: {
      minWidth: 220,
      maxWidth: 280,
      borderRadius: RADIUS.inputSm,
      paddingHorizontal: SPACING.xl,
      paddingVertical: 14,
      backgroundColor: colors.toastBackground,
      ...SHADOWS.md,
    },
    title: {
      color: colors.toastText,
      fontSize: 15,
      fontWeight: "500",
      textAlign: "center",
    },
  });
