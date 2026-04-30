import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppScreenLoader } from "@/components/app-screen-loader";
import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { getActionErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AuthorApplyScreen() {
  const { colors } = useAppTheme();
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const { isBootstrapping, profile, role, switchCurrentUserToAuthor, user } = useAuth();
  const router = useRouter();
  const styles = createStyles(colors);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (isBootstrapping || (user && !profile)) {
    return <AppScreenLoader backgroundColor={colors.background} indicatorColor={colors.primary} />;
  }

  if (!user) {
    return <Redirect href="/auth-choice" />;
  }

  if (role !== "user") {
    return <Redirect href="/profile" />;
  }

  const hasCompleteProfile = Boolean(
    profile?.firstName.trim() &&
      profile?.username.trim() &&
      profile?.gender.trim() &&
      profile?.bio.trim(),
  );

  const handleSwitch = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      await switchCurrentUserToAuthor();
      showToast("Author profile enabled.");
    } catch (error) {
      setSubmitError(
        getActionErrorMessage({
          error,
          isConnected,
          fallbackMessage: "Unable to switch to author right now.",
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmSwitch = () => {
    Alert.alert(
      "Switch to Author Profile",
      "This is a one-way switch. After becoming an author, you cannot change back to user from this app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: () => {
            void handleSwitch();
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Switch to Author Profile</Text>
      <Text style={styles.subtitle}>
        You do not need to apply anymore. Complete your profile and switch directly to author.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What changes</Text>
        <Text style={styles.helperText}>You will unlock My Posts and your public author page.</Text>
        <Text style={styles.helperText}>
          This switch is one-way. After you become an author, you cannot switch back to user from the app.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Before switching</Text>
        <Text style={styles.helperText}>
          First name, username, gender, and bio must be completed in your profile.
        </Text>
        <Text style={styles.statusText}>
          {hasCompleteProfile ? "Your profile is ready." : "Your profile is incomplete."}
        </Text>
      </View>

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      {!hasCompleteProfile ? (
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push("/profile-edit")}
        >
          <Text style={styles.secondaryButtonText}>Complete Profile</Text>
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isSubmitting) && styles.buttonPressed,
            isSubmitting && styles.buttonDisabled,
          ]}
          onPress={confirmSwitch}
          disabled={isSubmitting}
        >
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? "Switching..." : "Switch to Author"}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      padding: SPACING.xl,
      paddingBottom: SPACING.xxl * 2,
      gap: SPACING.md,
      backgroundColor: colors.background,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "700",
    },
    subtitle: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
      lineHeight: 22,
    },
    section: {
      borderRadius: RADIUS.lg,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      gap: SPACING.sm,
      ...SHADOWS.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    helperText: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 20,
    },
    statusText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    error: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
    },
    primaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    primaryButtonText: {
      color: colors.primaryText,
      fontSize: 15,
      fontWeight: "700",
    },
    secondaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.9,
    },
    buttonDisabled: {
      opacity: 0.65,
    },
  });
