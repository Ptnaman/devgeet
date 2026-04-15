import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { reload, sendEmailVerification } from "firebase/auth";

import { AppScreenLoader } from "@/components/app-screen-loader";
import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { auth } from "@/lib/firebase";
import { getActionErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AuthorAccessVerificationScreen() {
  const { colors } = useAppTheme();
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const { isBootstrapping, profile, user } = useAuth();
  const router = useRouter();
  const styles = createStyles(colors);
  const [error, setError] = useState("");
  const [isVerified, setIsVerified] = useState(Boolean(user?.emailVerified));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const isGoogleLogin = profile?.provider === "google";
  const accountEmail = profile?.email || user?.email || "";

  useEffect(() => {
    setIsVerified(Boolean(user?.emailVerified));
  }, [user?.emailVerified, user?.uid]);

  const refreshVerificationState = useCallback(
    async (showResultToast = false) => {
      if (isGoogleLogin) {
        setError("");
        setIsVerified(true);
        return;
      }

      if (!isConnected) {
        showOfflineToast();
        return;
      }

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setIsVerified(false);
        return;
      }

      try {
        setIsRefreshing(true);
        setError("");
        await reload(currentUser);
        await currentUser.getIdToken(true);

        const nextVerified = Boolean(auth.currentUser?.emailVerified ?? currentUser.emailVerified);
        setIsVerified(nextVerified);

        if (showResultToast) {
          showToast(nextVerified ? "Email verified." : "Email is not verified yet.");
        }
      } catch (verificationError) {
        setError(
          getActionErrorMessage({
            error: verificationError,
            isConnected,
            fallbackMessage: "Unable to refresh verification status.",
          }),
        );
      } finally {
        setIsRefreshing(false);
      }
    },
    [isConnected, isGoogleLogin, showOfflineToast, showToast],
  );

  useFocusEffect(
    useCallback(() => {
      void refreshVerificationState(false);
    }, [refreshVerificationState]),
  );

  if (isBootstrapping || (user && !profile)) {
    return <AppScreenLoader backgroundColor={colors.background} indicatorColor={colors.primary} />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const sendVerificationLink = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser || !currentUser.email) {
      setError("Unable to determine your account email.");
      return;
    }

    try {
      setIsSending(true);
      setError("");
      await sendEmailVerification(currentUser);
      showToast("Verification email sent.");
    } catch (verificationError) {
      setError(
        getActionErrorMessage({
          error: verificationError,
          isConnected,
          fallbackMessage: "Unable to send verification email right now.",
        }),
      );
    } finally {
      setIsSending(false);
    }
  };

  const statusLabel = isGoogleLogin
    ? "Not Required"
    : isVerified
      ? "Verified"
      : "Pending Verification";
  const statusText = isGoogleLogin
    ? "This account uses Google login, so author access does not need a separate verification step."
    : isVerified
      ? "Your email is verified. Go back to Author Access and submit your request."
      : "Send the verification email, open the link from your inbox, then refresh this page.";

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Verify Email</Text>
      <Text style={styles.subtitle}>
        Email-login accounts must verify email before author access can be requested.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View
        style={[
          styles.statusCard,
          isGoogleLogin || isVerified ? styles.statusCardSuccess : styles.statusCardPending,
        ]}
      >
        <Text style={styles.statusLabel}>{statusLabel}</Text>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.readonlyField}>
          <Text style={styles.readonlyValue}>{accountEmail || "No email found"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        {!isGoogleLogin && !isVerified ? (
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSending) && styles.buttonPressed,
              isSending && styles.buttonDisabled,
            ]}
            onPress={() => {
              void sendVerificationLink();
            }}
            disabled={isSending}
          >
            <Text style={styles.primaryButtonText}>
              {isSending ? "Sending..." : "Send Verification Email"}
            </Text>
          </Pressable>
        ) : null}

        {!isGoogleLogin ? (
          <Pressable
            style={({ pressed }) => [
              styles.outlineButton,
              (pressed || isRefreshing) && styles.buttonPressed,
              isRefreshing && styles.buttonDisabled,
            ]}
            onPress={() => {
              void refreshVerificationState(true);
            }}
            disabled={isRefreshing}
          >
            <Text style={styles.outlineButtonText}>
              {isRefreshing ? "Checking..." : "Refresh Verification Status"}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.outlineButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.outlineButtonText}>Back to Author Access</Text>
        </Pressable>
      </View>
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
      fontSize: FONT_SIZE.title,
      fontWeight: "700",
    },
    subtitle: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
      lineHeight: 20,
    },
    error: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
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
    statusCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.lg,
      gap: SPACING.xs,
    },
    statusCardSuccess: {
      borderColor: colors.successBorder,
      backgroundColor: colors.successSoft,
    },
    statusCardPending: {
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningSoft,
    },
    statusLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    statusText: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 20,
    },
    readonlyField: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surfaceSoft,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      justifyContent: "center",
    },
    readonlyValue: {
      color: colors.text,
      fontSize: FONT_SIZE.body,
      lineHeight: 20,
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
    outlineButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    outlineButtonText: {
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
