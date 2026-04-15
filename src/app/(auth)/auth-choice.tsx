import { useState } from "react";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GoogleAuthButton } from "@/components/google-auth-button";
import { AppleAuthButton } from "@/components/apple-auth-button";
import { MailInputIcon } from "@/components/icons/mail-input-icon";
import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

export default function AuthChoiceScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const router = useRouter();
  const [error, setError] = useState("");
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{"Let's get you in"}</Text>
          <Text style={styles.heroSubtitle}>
            Use Google or Apple for quick access, or continue with your email flow.
          </Text>
        </View>

        <View style={styles.sheet}>
          <Text style={styles.sectionTitle}>Continue with</Text>
          <GoogleAuthButton label="Continue with Google" onError={setError} />
          <AppleAuthButton onError={setError} />

          <Pressable
            style={({ pressed }) => [styles.emailButton, pressed && styles.buttonPressed]}
            onPress={() => router.push("/login")}
          >
            <View style={styles.emailButtonContent}>
              <MailInputIcon color={colors.primaryText} />
              <Text style={styles.emailButtonText}>Continue with Email</Text>
            </View>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  heroTitle: {
    color: colors.text,
    fontSize: FONT_SIZE.heroTitle + 4,
    fontWeight: "800",
    textAlign: "center",
  },
  heroSubtitle: {
    color: colors.mutedText,
    fontSize: FONT_SIZE.body + 1,
    textAlign: "center",
    lineHeight: 22,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
    ...SHADOWS.md,
  },
  sectionTitle: {
    color: colors.mutedText,
    fontSize: FONT_SIZE.body,
    textAlign: "center",
    fontWeight: "600",
  },
  emailButton: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  emailButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  emailButtonText: {
    color: colors.primaryText,
    fontSize: FONT_SIZE.button,
    fontWeight: "700",
  },
  error: {
    textAlign: "center",
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: SPACING.sm,
  },
  buttonPressed: {
    opacity: 0.86,
  },
});
