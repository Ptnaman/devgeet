import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { AppScreenLoader } from "@/components/app-screen-loader";
import {
  MARKETING_HEADLINE_GRADIENT_STOPS,
  ONBOARDING_SCREEN_THEMES,
  RADIUS,
  SPACING,
  type OnboardingScreenTheme,
} from "@/constants/theme";
import { resolveProductFontFamily } from "@/lib/typography";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

const HERO_TITLE = "Read every verse.";
const HERO_GRADIENT_TITLE = "Sing with ease.";
const ONBOARDING_SEEN_KEY = "app:onboarding_seen";

export default function IndexGate() {
  const router = useRouter();
  const { colors, resolvedTheme } = useAppTheme();
  const { user, isBootstrapping } = useAuth();
  const { width } = useWindowDimensions();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const screenColors = ONBOARDING_SCREEN_THEMES[resolvedTheme];
  const styles = createOnboardingScreenStyles(screenColors, Platform.OS === "ios");

  useEffect(() => {
    let isMounted = true;

    const loadOnboardingState = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
        if (isMounted) {
          setHasSeenOnboarding(storedValue === "true");
        }
      } catch {
        if (isMounted) {
          setHasSeenOnboarding(false);
        }
      }
    };

    void loadOnboardingState();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isBootstrapping || hasSeenOnboarding === null) {
    return (
      <AppScreenLoader
        backgroundColor={screenColors.background}
        indicatorColor={colors.primary}
      />
    );
  }

  if (user) {
    return <Redirect href="/home" />;
  }

  if (hasSeenOnboarding) {
    return <Redirect href="/auth-choice" />;
  }

  const titleFontSize = width < 360 ? 44 : width < 420 ? 50 : 56;
  const gradientFontSize = width < 360 ? 40 : width < 420 ? 46 : 52;
  const gradientCanvasWidth = Math.min(width - 48, 380);
  const gradientCanvasHeight = gradientFontSize + 20;
  const handleGetStarted = () => {
    setHasSeenOnboarding(true);
    void AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "true").catch(() => {});
    router.replace("/auth-choice");
  };

  return (
    <View style={styles.screen}>
      <StatusBar
        style={resolvedTheme === "dark" ? "light" : "dark"}
        backgroundColor={screenColors.background}
      />
      <BottomGlowBackground colors={screenColors} />

      <View style={styles.content}>
        <View style={styles.innerFrame}>
          <View style={styles.heroBlock}>
            <Text style={[styles.heroTitle, { fontSize: titleFontSize, lineHeight: titleFontSize + 4 }]}>
              {HERO_TITLE}
            </Text>

            <GradientHeadline
              text={HERO_GRADIENT_TITLE}
              width={gradientCanvasWidth}
              height={gradientCanvasHeight}
              fontSize={gradientFontSize}
            />

            <Text style={styles.heroCopy}>
              Discover devotional lyrics, follow fresh posts, and keep your favorite geet
              close whenever inspiration strikes.
            </Text>
          </View>

          <View style={styles.ctaBlock}>
            <Pressable
              accessibilityLabel="Get started and continue to sign in"
              accessibilityRole="button"
              onPress={handleGetStarted}
              style={({ pressed }) => [styles.ctaButton, pressed ? styles.ctaButtonPressed : undefined]}
            >
              <Text style={styles.ctaText}>Get started</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

type GradientHeadlineProps = {
  text: string;
  width: number;
  height: number;
  fontSize: number;
};

function GradientHeadline({ text, width, height, fontSize }: GradientHeadlineProps) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <SvgLinearGradient
          id="headlineGradient"
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          gradientUnits="userSpaceOnUse"
        >
          {MARKETING_HEADLINE_GRADIENT_STOPS.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </SvgLinearGradient>
      </Defs>

      <SvgText
        x={width / 2}
        y={fontSize}
        fill="url(#headlineGradient)"
        fontFamily={resolveProductFontFamily("bold")}
        fontSize={fontSize}
        letterSpacing={-1.2}
        textAnchor="middle"
      >
        {text}
      </SvgText>
    </Svg>
  );
}

function BottomGlowBackground({ colors }: { colors: OnboardingScreenTheme }) {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <RadialGradient id="warmGlow" cx="30" cy="102" r="40" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.warmGlowInner} stopOpacity="0.9" />
          <Stop offset="0.55" stopColor={colors.warmGlowOuter} stopOpacity="0.45" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="blueGlow" cx="82" cy="103" r="48" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.blueGlowInner} stopOpacity="0.96" />
          <Stop offset="0.52" stopColor={colors.blueGlowOuter} stopOpacity="0.5" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Ellipse cx="30" cy="104" rx="44" ry="18" fill="url(#warmGlow)" />
      <Ellipse cx="82" cy="104" rx="62" ry="28" fill="url(#blueGlow)" />
    </Svg>
  );
}

const createOnboardingScreenStyles = (
  colors: OnboardingScreenTheme,
  isIos: boolean,
) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: SPACING.xxl,
      paddingBottom: SPACING.lg,
    },
    innerFrame: {
      flex: 1,
      width: "100%",
      maxWidth: 430,
      alignSelf: "center",
    },
    heroBlock: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 32,
      paddingBottom: 52,
    },
    heroTitle: {
      color: colors.title,
      fontFamily: resolveProductFontFamily("bold"),
      textAlign: "center",
      letterSpacing: -1.5,
    },
    heroCopy: {
      maxWidth: 360,
      marginTop: 18,
      color: colors.body,
      fontSize: 17,
      lineHeight: 32,
      textAlign: "center",
      letterSpacing: -0.2,
    },
    ctaBlock: {
      alignItems: "center",
      paddingBottom: isIos ? 48 : 36,
    },
    ctaButton: {
      minWidth: 230,
      paddingHorizontal: 42,
      paddingVertical: 18,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.button,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
    ctaButtonPressed: {
      transform: [{ scale: 0.985 }],
    },
    ctaText: {
      color: colors.buttonText,
      fontFamily: resolveProductFontFamily("bold"),
      fontSize: 19,
      letterSpacing: -0.4,
    },
  });
