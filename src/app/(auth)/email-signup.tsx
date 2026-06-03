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
  PASSWORD_VALIDATION_MESSAGE,
  isValidEmailAddress,
} from "@/lib/auth-validation";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function EmailSignupScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { signupWithEmailPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid = isValidEmailAddress(normalizedEmail);
  const hasPassword = password.length > 0;
  const hasConfirmPassword = confirmPassword.length > 0;
  const isPasswordConfirmed = password === confirmPassword;
  const canSubmit =
    !isSubmitting && isEmailValid && hasPassword && hasConfirmPassword && isPasswordConfirmed;

  const clearError = () => {
    if (error) {
      setError("");
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

    if (!hasConfirmPassword) {
      setError("Confirm your password.");
      return;
    }

    if (!isPasswordConfirmed) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await signupWithEmailPassword({ email: normalizedEmail, password });
      router.replace("/(main)/(tabs)");
    } catch (signupError) {
      const message = getActionErrorMessage({
        error: signupError,
        isConnected,
        fallbackMessage: "Unable to create your account right now.",
      });
      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      eyebrow="Create Account"
      title="Email Signup"
      subtitle="Create a new account with email and password."
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
                clearError();
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
                clearError();
              }}
              placeholder="Password"
              placeholderTextColor={colors.placeholderText}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="next"
              style={styles.input}
            />
          </View>

          <View style={styles.inputWrap}>
            <LockPasswordIcon color={colors.iconMuted} size={20} />
            <TextInput
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                clearError();
              }}
              placeholder="Confirm password"
              placeholderTextColor={colors.placeholderText}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              autoComplete="password-new"
              textContentType="password"
              returnKeyType="done"
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.helperText}>{PASSWORD_VALIDATION_MESSAGE}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
            <Text style={styles.primaryButtonText}>Create Account</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkButton, pressed ? styles.modeButtonPressed : null]}
          onPress={() => {
            router.push("./email-login");
          }}
        >
          <Text style={styles.linkButtonText}>Already have an account? Login</Text>
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
    helperText: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 17,
    },
    errorText: {
      color: colors.danger,
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
