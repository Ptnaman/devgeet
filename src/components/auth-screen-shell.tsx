import { type ReactNode, type RefObject, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";
import { SPACING, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type AuthScreenShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  showTopBar?: boolean;
  showHero?: boolean;
  centerContent?: boolean;
  topAligned?: boolean;
  backgroundColor?: string;
  safeAreaEdges?: Edge[];
  scrollViewRef?: RefObject<ScrollView | null>;
  scrollContentStyle?: StyleProp<ViewStyle>;
  heroStyle?: StyleProp<ViewStyle>;
  layoutStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export function AuthScreenShell({
  eyebrow,
  title,
  subtitle,
  onBack,
  children,
  footer,
  showTopBar = true,
  showHero = true,
  centerContent = false,
  topAligned = false,
  backgroundColor,
  safeAreaEdges = ["top", "bottom"],
  scrollViewRef,
  scrollContentStyle,
  heroStyle,
  layoutStyle,
  titleStyle,
  subtitleStyle,
}: AuthScreenShellProps) {
  const { colors, resolvedTheme } = useAppTheme();
  const styles = createStyles(colors);
  const resolvedBackgroundColor = backgroundColor ?? colors.background;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: resolvedBackgroundColor }]}
      edges={safeAreaEdges}
    >
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            topAligned || isKeyboardVisible ? styles.scrollContentTopAligned : undefined,
            isKeyboardVisible ? styles.scrollContentKeyboardOpen : undefined,
            { backgroundColor: resolvedBackgroundColor },
            scrollContentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          <View style={[styles.layout, layoutStyle]}>
            {showTopBar ? (
              <View style={styles.topBar}>
                <Pressable
                  style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : undefined]}
                  onPress={onBack}
                >
                  <View style={styles.backIcon}>
                    <ArrowRightIcon size={18} color={colors.text} />
                  </View>
                </Pressable>

                <Text style={styles.eyebrow}>{eyebrow}</Text>
              </View>
            ) : null}

            {showHero ? (
              <View
                style={[styles.hero, centerContent ? styles.heroCentered : undefined, heroStyle]}
              >
                <Text
                  style={[styles.title, centerContent ? styles.textCentered : undefined, titleStyle]}
                >
                  {title}
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    centerContent ? styles.textCentered : undefined,
                    subtitleStyle,
                  ]}
                >
                  {subtitle}
                </Text>
              </View>
            ) : null}

            <View style={[styles.content, centerContent ? styles.contentCentered : undefined]}>
              {children}
            </View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoiding: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.xl,
    },
    scrollContentTopAligned: {
      justifyContent: "flex-start",
    },
    scrollContentKeyboardOpen: {
      paddingBottom: SPACING.xxl * 3,
    },
    layout: {
      width: "100%",
      maxWidth: 430,
      alignSelf: "center",
      paddingHorizontal: SPACING.xs,
      paddingVertical: SPACING.sm,
      gap: SPACING.xl,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    backIcon: {
      transform: [{ rotate: "180deg" }],
    },
    eyebrow: {
      color: colors.iconMuted,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "700",
    },
    hero: {
      gap: SPACING.sm,
    },
    heroCentered: {
      alignItems: "center",
    },
    title: {
      color: colors.text,
      fontSize: 30,
      lineHeight: 36,
      fontWeight: "800",
    },
    subtitle: {
      color: colors.subtitleText,
      fontSize: 15,
      lineHeight: 24,
    },
    textCentered: {
      textAlign: "center",
    },
    content: {
      gap: SPACING.lg,
      width: "100%",
    },
    contentCentered: {
      alignSelf: "center",
    },
    footer: {
      paddingTop: SPACING.xs,
    },
    pressed: {
      opacity: 0.8,
    },
  });
