import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthScreenShell } from "@/components/auth-screen-shell";
import { LockPasswordIcon } from "@/components/icons/lock-password-icon";
import { MailInputIcon } from "@/components/icons/mail-input-icon";
import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import {
  EMAIL_VALIDATION_MESSAGE,
  isValidEmailAddress,
} from "@/lib/auth-validation";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function EmailLoginScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const {
    loginWithEmailPassword,
    sendPasswordResetForEmail,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid = isValidEmailAddress(normalizedEmail);
  const hasPassword = password.length > 0;
  const canSubmit = !isSubmitting && isEmailValid && hasPassword;

  const clearFeedback = () => {
    if (error) {
      setError("");
    }
    if (info) {
      setInfo("");
    }
  };

  const handleSubmit = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    if (!isEmailValid) {
      setError(EMAIL_VALIDATION_MESSAGE);
      return;
    }

    if (!hasPassword) {
      setError("Password is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setInfo("");
      await loginWithEmailPassword({ email: normalizedEmail, password });

      router.replace("/(main)/(tabs)");
    } catch (authActionError) {
      const message = getActionErrorMessage({
        error: authActionError,
        isConnected,
        fallbackMessage: "Unable to login right now.",
      });
      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    if (!isEmailValid) {
      setError(EMAIL_VALIDATION_MESSAGE);
      return;
    }

    try {
      setIsSendingReset(true);
      setError("");
      setInfo("");
      await sendPasswordResetForEmail(normalizedEmail);
      setInfo("Password reset link sent. Check your inbox.");
    } catch (resetError) {
      const message = getActionErrorMessage({
        error: resetError,
        isConnected,
        fallbackMessage: "Unable to send reset link right now.",
      });
      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }
      setError(message);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <AuthScreenShell
      eyebrow="Account Access"
      title="Email Login"
      subtitle="Login with your email and password."
      onBack={() => {
        router.replace("/auth-choice");
      }}
      topAligned
      scrollContentStyle={styles.scrollContent}
    >
      <View style={styles.formCard}>
        <View style={styles.inputStack}>
          <View style={styles.inputWrap}>
            <MailInputIcon color={colors.iconMuted} size={20} />
            <TextInput
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                clearFeedback();
              }}
              placeholder="Email address"
              placeholderTextColor={colors.placeholderText}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              style={styles.input}
            />
          </View>

          <View style={styles.inputWrap}>
            <LockPasswordIcon color={colors.iconMuted} size={20} />
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                clearFeedback();
              }}
              placeholder="Password"
              placeholderTextColor={colors.placeholderText}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="done"
              style={styles.input}
            />
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {info ? <Text style={styles.infoText}>{info}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.linkButton,
            (pressed || isSendingReset) ? styles.modeButtonPressed : null,
          ]}
          disabled={isSendingReset}
          onPress={() => {
            void handleResetPassword();
          }}
        >
          <Text style={styles.linkButtonText}>
            {isSendingReset ? "Sending reset link..." : "Forgot password?"}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            !canSubmit ? styles.primaryButtonDisabled : null,
            pressed && canSubmit ? styles.primaryButtonPressed : null,
          ]}
          disabled={!canSubmit}
          onPress={() => {
            void handleSubmit();
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <Text style={styles.primaryButtonText}>
              Login
            </Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkButton, pressed ? styles.modeButtonPressed : null]}
          onPress={() => {
            router.push("./email-signup");
          }}
        >
          <Text style={styles.linkButtonText}>Create new account</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkButton, pressed ? styles.modeButtonPressed : null]}
          onPress={() => {
            router.replace("/auth-choice");
          }}
        >
          <Text style={styles.linkButtonText}>Use Google instead</Text>
        </Pressable>
      </View>
    </AuthScreenShell>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scrollContent: {
      paddingTop: SPACING.sm,
    },
    formCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    modeButtonPressed: {
      opacity: 0.85,
    },
    inputStack: {
      gap: SPACING.sm,
    },
    inputWrap: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      lineHeight: 20,
      paddingVertical: 0,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    infoText: {
      color: colors.success,
      fontSize: 13,
      lineHeight: 18,
    },
    primaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonPressed: {
      opacity: 0.9,
    },
    primaryButtonText: {
      color: colors.primaryText,
      fontSize: FONT_SIZE.button,
      fontWeight: "700",
    },
    linkButton: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 34,
    },
    linkButtonText: {
      color: colors.accent,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
    },
  });
