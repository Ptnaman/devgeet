import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { GoogleAuthButton } from "@/components/google-auth-button";
import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

const LAST_LOGIN_IDENTIFIER_KEY = "auth:last_login_identifier";

const getErrorMessage = (
  error: unknown,
  fallbackMessage = "Unable to login. Please try again."
) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackMessage;
};

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { loginWithEmailOrUsername, requestPasswordReset } = useAuth();
  const styles = createStyles(colors);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isIdentifierFocused, setIsIdentifierFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  useEffect(() => {
    const hydrateScreenState = async () => {
      try {
        const savedIdentifier = await AsyncStorage.getItem(LAST_LOGIN_IDENTIFIER_KEY);
        if (savedIdentifier) {
          setIdentifier(savedIdentifier);
        }
      } catch {
        // Ignore local storage read issues and keep blank field.
      }
    };

    void hydrateScreenState();
  }, []);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setError("Enter username/email and password.");
      setSuccessMessage("");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setSuccessMessage("");
      const normalizedIdentifier = identifier.trim();
      await loginWithEmailOrUsername(normalizedIdentifier, password);
      await AsyncStorage.setItem(LAST_LOGIN_IDENTIFIER_KEY, normalizedIdentifier);
      router.replace("/home");
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!identifier.trim()) {
      setError("Enter your email or username first.");
      setSuccessMessage("");
      return;
    }

    try {
      setIsResettingPassword(true);
      setError("");
      setSuccessMessage("");
      const normalizedIdentifier = identifier.trim();
      await requestPasswordReset(normalizedIdentifier);
      await AsyncStorage.setItem(LAST_LOGIN_IDENTIFIER_KEY, normalizedIdentifier);
      setIdentifier(normalizedIdentifier);
      setSuccessMessage("Password reset email sent. Check your inbox.");
    } catch (passwordResetError) {
      setError(
        getErrorMessage(passwordResetError, "Unable to send reset email. Please try again.")
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  const clearFeedback = () => {
    if (error) {
      setError("");
    }
    if (successMessage) {
      setSuccessMessage("");
    }
  };

  const isLoginDisabled = isSubmitting || isResettingPassword || !identifier.trim() || !password;
  const isPasswordResetDisabled = isSubmitting || isResettingPassword || !identifier.trim();

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.mainContent}>
        <View style={styles.hero}>
          <Text style={styles.title}>Login to DevGeet</Text>
          <Text style={styles.subtitle}>Welcome back to DevGeet.</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Email or Username</Text>
            <TextInput
              value={identifier}
              onChangeText={(value) => {
                setIdentifier(value);
                clearFeedback();
              }}
              onFocus={() => setIsIdentifierFocused(true)}
              onBlur={() => setIsIdentifierFocused(false)}
              placeholder="Enter your email or username"
              placeholderTextColor={colors.mutedText}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, isIdentifierFocused && styles.inputFocused]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View
              style={[styles.inputWithAction, isPasswordFocused && styles.inputFocused]}
            >
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  clearFeedback();
                }}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                placeholder="Enter your password"
                placeholderTextColor={colors.mutedText}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                style={styles.inputWithActionText}
                onSubmitEditing={() => {
                  if (!isLoginDisabled) {
                    void handleLogin();
                  }
                }}
              />
              <Pressable
                style={styles.toggleButton}
                onPress={() => setIsPasswordVisible((current) => !current)}
                hitSlop={8}
              >
                <Text style={styles.toggleText}>
                  {isPasswordVisible ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>
          </View>

          {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              isLoginDisabled && styles.primaryButtonDisabled,
              pressed && !isLoginDisabled && styles.buttonPressed,
            ]}
            onPress={handleLogin}
            disabled={isLoginDisabled}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  isLoginDisabled && styles.primaryButtonTextDisabled,
                ]}
              >
                Continue
              </Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              isPasswordResetDisabled && styles.secondaryButtonDisabled,
              pressed && !isPasswordResetDisabled && styles.buttonPressed,
            ]}
            onPress={handleForgotPassword}
            disabled={isPasswordResetDisabled}
          >
            {isResettingPassword ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.secondaryButtonText}>Forgot password?</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <GoogleAuthButton label="Continue with Google" onError={setError} />
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    backgroundColor: colors.background,
  },
  mainContent: {
    gap: SPACING.lg,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  hero: {
    alignItems: "center",
    gap: SPACING.xs,
  },
  title: {
    color: colors.text,
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: FONT_SIZE.body + 1,
    lineHeight: 20,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.card,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  field: {
    gap: SPACING.xs,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: colors.text,
    fontSize: FONT_SIZE.button,
  },
  inputWithAction: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: RADIUS.md,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  inputWithActionText: {
    flex: 1,
    color: colors.text,
    fontSize: FONT_SIZE.button,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  toggleButton: {
    minWidth: 54,
    height: 34,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
  },
  toggleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  success: {
    color: colors.success,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: CONTROL_SIZE.inputHeight + 2,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    backgroundColor: colors.surfaceSoft,
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontWeight: "700",
    fontSize: FONT_SIZE.button + 2,
  },
  primaryButtonTextDisabled: {
    color: colors.subtleText,
  },
  secondaryButton: {
    minHeight: CONTROL_SIZE.inputHeight + 2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: FONT_SIZE.button + 1,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    textAlign: "center",
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
