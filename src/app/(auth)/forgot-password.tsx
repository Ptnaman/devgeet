import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AuthScreenShell } from "@/components/auth-screen-shell";
import { AuthSoftInput } from "@/components/auth-soft-field";
import { CancelInputIcon } from "@/components/icons/cancel-input-icon";
import { CONTROL_SIZE, FONT_SIZE, SPACING, type ThemeColors } from "@/constants/theme";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const LAST_LOGIN_IDENTIFIER_KEY = "auth:last_login_identifier";

const getErrorMessage = (error: unknown, isConnected: boolean) =>
  getActionErrorMessage({
    error,
    isConnected,
    fallbackMessage: "Unable to send reset email. Please try again.",
  });

export default function ForgotPasswordScreen() {
  const { colors } = useAppTheme();
  const { email: routeEmail, identifier: routeIdentifier } = useLocalSearchParams<{
    email?: string;
    identifier?: string;
  }>();
  const { requestPasswordReset } = useAuth();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const styles = createStyles(colors);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const hydrateEmail = async () => {
      const nextIdentifier =
        typeof routeIdentifier === "string" && routeIdentifier.trim()
          ? routeIdentifier.trim()
          : typeof routeEmail === "string" && routeEmail.trim()
            ? routeEmail.trim()
            : "";

      if (nextIdentifier) {
        setEmail(nextIdentifier);
        return;
      }

      try {
        const savedIdentifier = await AsyncStorage.getItem(LAST_LOGIN_IDENTIFIER_KEY);
        if (savedIdentifier) {
          setEmail(savedIdentifier);
        }
      } catch {
        // Ignore local read failures and keep the field empty.
      }
    };

    void hydrateEmail();
  }, [routeEmail, routeIdentifier]);

  const handleResetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setEmailError("Enter your email or username.");
      setSuccessMessage("");
      return;
    }

    try {
      setIsSubmitting(true);
      setEmailError("");
      setSuccessMessage("");
      await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setSuccessMessage("Password reset link sent. Check your inbox.");
    } catch (requestError) {
      const message = getErrorMessage(requestError, isConnected);
      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }
      setEmailError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      eyebrow=""
      title="Forgot Password"
      subtitle={"Enter your email or username and we\u2019ll\nsend you a secure reset link."}
      showTopBar={false}
      centerContent
      topAligned
    >
      <View style={styles.formStack}>
        <AuthSoftInput
          label="Email or Username"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (emailError) {
              setEmailError("");
            }
            if (successMessage) {
              setSuccessMessage("");
            }
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          tone={emailError ? "error" : "default"}
          errorMessage={emailError}
          supportingText={successMessage}
          supportingTone="success"
          trailingAccessory={
            email ? (
              <Pressable
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed ? styles.clearButtonPressed : undefined,
                ]}
                onPress={() => {
                  setEmail("");
                  setEmailError("");
                  setSuccessMessage("");
                }}
                hitSlop={8}
              >
                <CancelInputIcon color={emailError ? colors.danger : colors.subtitleText} />
              </Pressable>
            ) : null
          }
        />

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            isSubmitting ? styles.primaryButtonDisabled : undefined,
            pressed && !isSubmitting ? styles.pressed : undefined,
          ]}
          onPress={handleResetPassword}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.brandPrimaryText} />
          ) : (
            <Text style={styles.primaryButtonText}>Reset Password</Text>
          )}
        </Pressable>
      </View>
    </AuthScreenShell>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    formStack: {
      gap: SPACING.lg,
    },
    clearButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    clearButtonPressed: {
      opacity: 0.72,
    },
    primaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: 14,
      backgroundColor: colors.brandPrimary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: colors.brandPrimaryText,
      fontSize: FONT_SIZE.button,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.82,
    },
  });
