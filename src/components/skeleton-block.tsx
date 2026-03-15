import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { RADIUS, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type SkeletonBlockProps = {
  width?: number | `${number}%` | "100%";
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBlock({
  width = "100%",
  height,
  borderRadius = RADIUS.md,
  style,
}: SkeletonBlockProps) {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  const styles = createStyles(colors);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  block: {
    backgroundColor: colors.divider,
  },
});
