import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthSoftInput } from "@/components/auth-soft-field";
import { CancelInputIcon } from "@/components/icons/cancel-input-icon";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { ViewOffIcon } from "@/components/icons/view-off-icon";
import { ViewOnIcon } from "@/components/icons/view-on-icon";
import {
  CONTROL_SIZE,
  FONT_SIZE,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import {
  EMAIL_VALIDATION_MESSAGE,
  isValidEmailAddress,
  normalizeEmailAddress,
} from "@/lib/auth-validation";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

type LoginField = "identifier" | "password";
type LoginFieldErrors = Partial<Record<LoginField, string>>;

const LAST_LOGIN_IDENTIFIER_KEY = "auth:last_login_identifier";
const REMEMBER_ME_PREFERENCE_KEY = "auth:remember_me";

const readErrorCode = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return "";
};

const getErrorMessage = (
  error: unknown,
  isConnected: boolean,
  fallbackMessage = "Unable to login. Please try again."
) =>
  getActionErrorMessage({
    error,
    isConnected,
    fallbackMessage,
  });

const resolveLoginErrorState = (
  error: unknown,
  isConnected: boolean,
  fallbackMessage = "Unable to login. Please try again."
) => {
  const message = getErrorMessage(error, isConnected, fallbackMessage);
  const code = readErrorCode(error);
  const normalizedMessage = message.toLowerCase();

  if (code === "auth/invalid-email") {
    return { field: "identifier" as const, message };
  }

  if (code === "auth/wrong-password" || code === "auth/missing-password") {
    return { field: "password" as const, message };
  }

  if (normalizedMessage.includes("username") || normalizedMessage.includes("email")) {
    return { field: "identifier" as const, message };
  }

  if (normalizedMessage.includes("password")) {
    return { field: "password" as const, message };
  }

  return { message };
};

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        d="M2 6.25L4.5 8.75L10 3.25"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const router = useRouter();
  const { loginWithEmailOrUsername, setRememberSessionPersistence } = useAuth();
  const styles = createStyles(colors);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasHydratedScreenState, setHasHydratedScreenState] = useState(false);

  useEffect(() => {
    const hydrateScreenState = async () => {
      try {
        const [savedIdentifier, savedRememberPreference] = await Promise.all([
          AsyncStorage.getItem(LAST_LOGIN_IDENTIFIER_KEY),
          AsyncStorage.getItem(REMEMBER_ME_PREFERENCE_KEY),
        ]);
        const nextRememberMe =
          savedRememberPreference === null ? true : savedRememberPreference === "true";

        setRememberMe(nextRememberMe);

        if (nextRememberMe && savedIdentifier) {
          setIdentifier(savedIdentifier);
        } else if (!nextRememberMe && savedIdentifier) {
          await AsyncStorage.removeItem(LAST_LOGIN_IDENTIFIER_KEY);
        }
      } catch {
        // Ignore local storage read issues and keep blank field.
      } finally {
        setHasHydratedScreenState(true);
      }
    };

    void hydrateScreenState();
  }, []);

  useEffect(() => {
    if (!hasHydratedScreenState) {
      return;
    }

    const persistRememberPreference = async () => {
      try {
        await AsyncStorage.setItem(REMEMBER_ME_PREFERENCE_KEY, String(rememberMe));
      } catch {
        // Ignore local storage write issues and keep the in-memory preference.
      }
    };

    void persistRememberPreference();
  }, [hasHydratedScreenState, rememberMe]);

  const normalizedIdentifier = identifier.trim();
  const identifierLooksLikeEmail = normalizedIdentifier.includes("@");
  const identifierFormatError =
    normalizedIdentifier &&
    identifierLooksLikeEmail &&
    !isValidEmailAddress(normalizeEmailAddress(identifier))
      ? EMAIL_VALIDATION_MESSAGE
      : undefined;

  const handleLogin = async () => {
    const nextErrors: LoginFieldErrors = {};

    if (!identifier.trim()) {
      nextErrors.identifier = "Enter your email or username.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setLoginError("");
      return;
    }

    try {
      setIsSubmitting(true);
      setFieldErrors({});
      setLoginError("");
      const normalizedIdentifier = identifier.trim();
      await setRememberSessionPersistence(rememberMe);
      await loginWithEmailOrUsername(normalizedIdentifier, password);
      if (rememberMe) {
        await AsyncStorage.setItem(LAST_LOGIN_IDENTIFIER_KEY, normalizedIdentifier);
      } else {
        await AsyncStorage.removeItem(LAST_LOGIN_IDENTIFIER_KEY);
      }
      router.replace("/home");
    } catch (loginError) {
      const message = getErrorMessage(loginError, isConnected, "Unable to login. Please try again.");
      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }
      const nextError = resolveLoginErrorState(
        loginError,
        isConnected,
        "Unable to login. Please try again.",
      );

      if (nextError.field) {
        setFieldErrors({ [nextError.field]: nextError.message });
        setLoginError("");
      } else {
        setFieldErrors({});
        setLoginError(nextError.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFeedback = (field: LoginField) => {
    if (loginError) {
      setLoginError("");
    }

    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const isLoginDisabled = isSubmitting || !identifier.trim() || !password;
  const identifierError = fieldErrors.identifier ?? identifierFormatError;
  const passwordError = fieldErrors.password;
  const identifierSupportingText =
    identifierLooksLikeEmail
      ? normalizedIdentifier && !identifierError
        ? "Email format looks valid."
        : "Enter the email linked to your account."
      : "You can login with either your email or username.";
  const identifierSupportingTone =
    normalizedIdentifier && identifierLooksLikeEmail && !identifierError ? "success" : "default";
  const passwordSupportingText = "Password is case-sensitive.";
  const hasIdentifierError = Boolean(identifierError);
  const hasPasswordError = Boolean(passwordError);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>{"Let's Sign You In"}</Text>
              <Text style={styles.subtitle}>{"Welcome back, you've been missed!"}</Text>
            </View>

            <View style={styles.formStack}>
              <View style={styles.fieldGroup}>
                <AuthSoftInput
                  label="Email or Username"
                  value={identifier}
                  onChangeText={(value) => {
                    setIdentifier(value);
                    clearFeedback("identifier");
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  tone={
                    hasIdentifierError
                      ? "error"
                      : normalizedIdentifier && identifierLooksLikeEmail && !identifierError
                        ? "success"
                        : "default"
                  }
                  errorMessage={identifierError}
                  supportingText={identifierSupportingText}
                  supportingTone={identifierSupportingTone}
                  trailingAccessory={
                    identifier ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.clearButton,
                          pressed && styles.eyeButtonPressed,
                        ]}
                        onPress={() => {
                          setIdentifier("");
                          clearFeedback("identifier");
                        }}
                        hitSlop={8}
                      >
                        <CancelInputIcon
                          color={hasIdentifierError ? colors.danger : colors.iconMuted}
                        />
                      </Pressable>
                    ) : null
                  }
                  inputStyle={styles.inputText}
                />
              </View>

              <View style={styles.fieldGroup}>
                <AuthSoftInput
                  label="Password"
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      clearFeedback("password");
                    }}
                    secureTextEntry={!isPasswordVisible}
                    autoCapitalize="none"
                    tone={hasPasswordError ? "error" : "default"}
                    errorMessage={passwordError}
                    supportingText={passwordSupportingText}
                    inputStyle={styles.inputText}
                  onSubmitEditing={() => {
                    if (!isLoginDisabled) {
                      void handleLogin();
                    }
                  }}
                  trailingAccessory={
                    <Pressable
                      style={({ pressed }) => [styles.eyeButton, pressed && styles.eyeButtonPressed]}
                      onPress={() => setIsPasswordVisible((current) => !current)}
                      hitSlop={8}
                    >
                      {isPasswordVisible ? (
                        <ViewOnIcon color={colors.iconMuted} />
                      ) : (
                        <ViewOffIcon color={colors.iconMuted} />
                      )}
                    </Pressable>
                  }
                />
              </View>

              <View style={styles.optionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.rememberAction,
                    isSubmitting && styles.auxiliaryActionDisabled,
                    pressed && styles.rememberActionPressed,
                  ]}
                  onPress={() => setRememberMe((current) => !current)}
                  disabled={isSubmitting}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe ? <CheckIcon color={colors.brandPrimaryText} /> : null}
                  </View>
                  <Text style={styles.rememberText}>Remember Me</Text>
                </Pressable>

                <Pressable
                  style={isSubmitting ? styles.auxiliaryActionDisabled : undefined}
                  onPress={() => {
                    const normalizedIdentifier = identifier.trim();
                    router.push({
                      pathname: "/forgot-password",
                      params: normalizedIdentifier ? { identifier: normalizedIdentifier } : {},
                    });
                  }}
                  hitSlop={8}
                  disabled={isSubmitting}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>
              </View>

              {loginError ? <Text style={styles.inlineError}>{loginError}</Text> : null}

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
                  <ActivityIndicator size="small" color={colors.brandPrimaryText} />
                ) : (
                  <Text style={styles.primaryButtonText}>Login</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <GoogleAuthButton
                label="Continue with Google"
                onError={(message) => {
                  setFieldErrors({});
                  setLoginError(message);
                }}
                showTrailingIcon={false}
                rememberSession={rememberMe}
                containerStyle={styles.googleButton}
              />
            </View>

            <Text style={styles.footerText}>
              {"Don't have Account?"}{" "}
              <Link href="/signup" style={styles.footerLink}>
                Sign up
              </Link>
            </Text>
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
      backgroundColor: colors.surface,
    },
    keyboardAvoiding: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "flex-start",
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xxl * 2,
      backgroundColor: colors.surface,
    },
    content: {
      width: "100%",
      maxWidth: 420,
      alignSelf: "center",
      justifyContent: "center",
      gap: SPACING.xxl,
    },
    header: {
      width: "100%",
      gap: SPACING.sm + 2,
      alignItems: "flex-start",
    },
    title: {
      color: colors.text,
      fontSize: 36,
      lineHeight: 42,
      fontWeight: "800",
      letterSpacing: -0.6,
      textAlign: "left",
      maxWidth: 320,
    },
    subtitle: {
      color: colors.mutedText,
      fontSize: 18,
      lineHeight: 28,
      fontWeight: "600",
      maxWidth: 340,
      textAlign: "left",
    },
    formStack: {
      gap: SPACING.lg,
    },
    fieldGroup: {
      gap: 6,
    },
    inputText: {
      color: colors.text,
      fontSize: FONT_SIZE.button,
    },
    eyeButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    clearButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    eyeButtonPressed: {
      opacity: 0.72,
    },
    optionsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
      marginTop: SPACING.xs,
    },
    rememberAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm + 2,
    },
    rememberActionPressed: {
      opacity: 0.82,
    },
    auxiliaryActionDisabled: {
      opacity: 0.52,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: colors.brandPrimary,
      borderColor: colors.brandPrimary,
    },
    rememberText: {
      color: colors.iconMuted,
      fontSize: FONT_SIZE.body,
      fontWeight: "500",
    },
    forgotText: {
      color: colors.brandAccent,
      fontSize: FONT_SIZE.body,
      fontWeight: "700",
    },
    inlineError: {
      color: colors.danger,
      fontSize: 12,
      lineHeight: 18,
      paddingHorizontal: 2,
    },
    primaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: 16,
      backgroundColor: colors.brandPrimary,
      alignItems: "center",
      justifyContent: "center",
      ...SHADOWS.md,
    },
    primaryButtonDisabled: {
      backgroundColor: colors.brandPrimaryDisabled,
    },
    primaryButtonText: {
      color: colors.brandPrimaryText,
      fontSize: FONT_SIZE.button,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.9,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      paddingVertical: SPACING.sm,
      marginTop: SPACING.xs,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.inputBorder,
    },
    dividerText: {
      color: colors.subtitleText,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.4,
    },
    googleButton: {
      backgroundColor: colors.surfaceSoft,
      borderRadius: 16,
      borderWidth: 0,
    },
    footerText: {
      textAlign: "center",
      color: colors.iconMuted,
      fontSize: 15,
      lineHeight: 22,
      paddingTop: SPACING.sm,
    },
    footerLink: {
      color: colors.brandAccent,
      fontWeight: "700",
    },
  });
