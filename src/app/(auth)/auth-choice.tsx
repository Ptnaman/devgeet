import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { GoogleAuthButton } from "@/components/google-auth-button";
import { APP_LINKS } from "@/constants/app-links";
import {
  AUTH_CHOICE_SCREEN_THEMES,
  MARKETING_HEADLINE_GRADIENT_STOPS,
  SPACING,
  type AuthChoiceScreenTheme,
} from "@/constants/theme";
import { resolveProductFontFamily } from "@/lib/typography";
import { useAppTheme } from "@/providers/theme-provider";

const HERO_GRADIENT_TITLE = "Login with Google";

export default function AuthChoiceScreen() {
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === "dark";
  const { width } = useWindowDimensions();
  const [error, setError] = useState("");
  const screenColors = AUTH_CHOICE_SCREEN_THEMES[resolvedTheme];
  const styles = createAuthChoiceScreenStyles(screenColors, Platform.OS === "ios", isDark);
  const gradientFontSize = width < 360 ? 27 : width < 420 ? 32 : 38;
  const gradientWidth = Math.min(width - 28, 348);
  const gradientHeight = gradientFontSize + 16;
  const openLegalLink = (url: string) => {
    void Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={screenColors.background}
      />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroGradientWrap}>
            <GradientHeadline
              text={HERO_GRADIENT_TITLE}
              width={gradientWidth}
              height={gradientHeight}
              fontSize={gradientFontSize}
            />
          </View>

          <Text style={styles.heroSubtitle}>
            Sign in to save favorites, follow fresh posts, and keep every geet
            ready across your devices.
          </Text>
        </View>

        <View style={styles.sheetStack}>
          <View style={styles.sheet}>
            <GoogleAuthButton
              label="Continue with Google"
              onError={setError}
              containerStyle={styles.googleButton}
              textStyle={styles.googleButtonText}
              showTrailingIcon={false}
            />

            <Text style={styles.consentText}>
              By continuing, you agree to our{" "}
              <Text
                style={styles.consentLink}
                onPress={() => {
                  openLegalLink(APP_LINKS.terms);
                }}
              >
                Terms & Conditions
              </Text>{" "}
              and{" "}
              <Text
                style={styles.consentLink}
                onPress={() => {
                  openLegalLink(APP_LINKS.privacy);
                }}
              >
                Privacy Policy
              </Text>
              .
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
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

function GradientHeadline({
  text,
  width,
  height,
  fontSize,
}: GradientHeadlineProps) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <SvgLinearGradient
          id="authChoiceHeadlineGradient"
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
        fill="url(#authChoiceHeadlineGradient)"
        fontFamily={resolveProductFontFamily("bold")}
        fontSize={fontSize}
        lengthAdjust="spacingAndGlyphs"
        letterSpacing={-0.8}
        textAnchor="middle"
        textLength={width - 6}
      >
        {text}
      </SvgText>
    </Svg>
  );
}

const createAuthChoiceScreenStyles = (
  colors: AuthChoiceScreenTheme,
  isIos: boolean,
  isDark: boolean,
) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    container: {
      flex: 1,
      justifyContent: "space-between",
      paddingHorizontal: SPACING.xxl,
      paddingTop: isIos ? 68 : 38,
      paddingBottom: isIos ? 34 : SPACING.xxl,
    },
    hero: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: SPACING.xxl,
      paddingHorizontal: SPACING.xs,
    },
    heroGradientWrap: {
      marginTop: SPACING.xs,
    },
    heroTitle: {
      color: colors.title,
      fontFamily: resolveProductFontFamily("bold"),
      textAlign: "center",
      letterSpacing: -1.2,
    },
    heroSubtitle: {
      maxWidth: 320,
      marginTop: SPACING.md,
      color: colors.body,
      fontSize: 15,
      lineHeight: 25,
      textAlign: "center",
      letterSpacing: -0.2,
    },
    sheetStack: {
      paddingBottom: SPACING.xs,
    },
    sheet: {
      paddingHorizontal: SPACING.xs,
      paddingTop: 6,
      paddingBottom: SPACING.sm,
      gap: 14,
    },
    sectionTitle: {
      color: colors.note,
      fontSize: 14,
      lineHeight: 18,
      textAlign: "center",
      fontFamily: resolveProductFontFamily("medium"),
      letterSpacing: -0.1,
    },
    sectionSubtitle: {
      color: colors.body,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
      marginTop: -2,
      marginBottom: SPACING.xs,
    },
    googleButton: {
      backgroundColor: isDark ? colors.googleButtonBackground : "#111111",
      borderColor: isDark ? colors.googleButtonBorder : "#111111",
    },
    googleButtonText: {
      color: isDark ? "#111111" : "#FFFFFF",
      fontFamily: resolveProductFontFamily("medium"),
      fontSize: 15,
      letterSpacing: -0.1,
    },
    consentText: {
      color: colors.note,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      paddingHorizontal: SPACING.sm,
    },
    consentLink: {
      color: colors.note,
      textDecorationLine: "underline",
      fontFamily: resolveProductFontFamily("medium"),
    },
    error: {
      color: colors.errorText,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      paddingHorizontal: SPACING.sm,
    },
  });
