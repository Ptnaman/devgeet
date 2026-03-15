import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unable to create account. Please try again.";
};

type FocusedField =
  | "firstName"
  | "lastName"
  | "email"
  | "password"
  | "confirmPassword";

export default function SignupScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { signupWithEmail } = useAuth();
  const styles = createStyles(colors);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const hasPasswordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const isPasswordTooShort = password.length > 0 && password.length < 6;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleSignup = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Fill first name, last name, email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const normalizedFirstName = firstName.trim();
      const normalizedLastName = lastName.trim();
      const normalizedEmail = email.trim().toLowerCase();

      await signupWithEmail({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        password,
      });
      router.replace("/home");
    } catch (signupError) {
      setError(getErrorMessage(signupError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSignupDisabled =
    isSubmitting ||
    !firstName.trim() ||
    !lastName.trim() ||
    !email.trim() ||
    !password ||
    !confirmPassword ||
    isPasswordTooShort ||
    hasPasswordMismatch;

  const clearError = () => {
    if (error) {
      setError("");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isKeyboardVisible && styles.scrollKeyboardOpen,
        ]}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mainContent}>
          <View style={styles.hero}>
            <Text style={styles.title}>Create your account</Text>
          </View>

          <View style={styles.formLayout}>
            <View style={styles.formIntro}>
              <Text style={styles.formTitle}>Basic details</Text>
              <Text style={styles.formSubtitle}>
                You can update profile details later from settings.
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Your name</Text>
              <View style={styles.nameRow}>
                <TextInput
                  value={firstName}
                  onChangeText={(value) => {
                    setFirstName(value);
                    clearError();
                  }}
                  onFocus={() => setFocusedField("firstName")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="First name"
                  placeholderTextColor={colors.mutedText}
                  autoCapitalize="words"
                  autoComplete="name-given"
                  returnKeyType="next"
                  style={[
                    styles.input,
                    styles.nameInput,
                    focusedField === "firstName" && styles.inputFocused,
                  ]}
                />

                <TextInput
                  value={lastName}
                  onChangeText={(value) => {
                    setLastName(value);
                    clearError();
                  }}
                  onFocus={() => setFocusedField("lastName")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Last name"
                  placeholderTextColor={colors.mutedText}
                  autoCapitalize="words"
                  autoComplete="name-family"
                  returnKeyType="next"
                  style={[
                    styles.input,
                    styles.nameInput,
                    focusedField === "lastName" && styles.inputFocused,
                  ]}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  clearError();
                }}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
                style={[styles.input, focusedField === "email" && styles.inputFocused]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputWithAction,
                  focusedField === "password" && styles.inputFocused,
                ]}
              >
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearError();
                  }}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Create a strong password"
                  placeholderTextColor={colors.mutedText}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  returnKeyType="next"
                  style={styles.inputWithActionText}
                />
                <Pressable
                  style={styles.toggleButton}
                  onPress={() => setIsPasswordVisible((current) => !current)}
                  hitSlop={8}
                >
                  <Text style={styles.toggleText}>{isPasswordVisible ? "Hide" : "Show"}</Text>
                </Pressable>
              </View>
              <Text
                style={[
                  styles.helperText,
                  isPasswordTooShort && styles.helperTextError,
                ]}
              >
                {isPasswordTooShort
                  ? "Use at least 6 characters."
                  : "Use at least 6 characters for your password."}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <View
                style={[
                  styles.inputWithAction,
                  focusedField === "confirmPassword" && styles.inputFocused,
                ]}
              >
                <TextInput
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    clearError();
                  }}
                  onFocus={() => setFocusedField("confirmPassword")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Re-enter your password"
                  placeholderTextColor={colors.mutedText}
                  secureTextEntry={!isConfirmPasswordVisible}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  returnKeyType="done"
                  style={styles.inputWithActionText}
                  onSubmitEditing={() => {
                    if (!isSignupDisabled) {
                      void handleSignup();
                    }
                  }}
                />
                <Pressable
                  style={styles.toggleButton}
                  onPress={() => setIsConfirmPasswordVisible((current) => !current)}
                  hitSlop={8}
                >
                  <Text style={styles.toggleText}>
                    {isConfirmPasswordVisible ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>
              {hasPasswordMismatch ? (
                <Text style={styles.helperTextError}>Passwords should match.</Text>
              ) : null}
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                isSignupDisabled && styles.buttonDisabled,
                pressed && !isSignupDisabled && styles.buttonPressed,
              ]}
              onPress={handleSignup}
              disabled={isSignupDisabled}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.primaryText} />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </Pressable>

            <Text style={styles.formFootnote}>
              Signing up takes less than a minute.
            </Text>
          </View>

          <Text style={styles.switchText}>
            Already have an account?{" "}
            <Link href="/login" style={styles.switchLink}>
              Login
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    backgroundColor: colors.background,
  },
  scrollKeyboardOpen: {
    justifyContent: "flex-start",
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl + SPACING.md,
  },
  mainContent: {
    width: "100%",
    maxWidth: 410,
    alignSelf: "center",
    gap: SPACING.lg,
  },
  hero: {
    alignItems: "center",
    gap: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  formLayout: {
    gap: SPACING.md,
  },
  formIntro: {
    gap: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  formTitle: {
    color: colors.text,
    fontSize: FONT_SIZE.button,
    fontWeight: "700",
  },
  formSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    gap: SPACING.xs,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  nameRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  input: {
    minHeight: CONTROL_SIZE.inputHeight - 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: SPACING.md,
    color: colors.text,
    fontSize: FONT_SIZE.button,
  },
  nameInput: {
    flex: 1,
  },
  inputWithAction: {
    minHeight: CONTROL_SIZE.inputHeight - 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
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
    height: 32,
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
  helperText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
  },
  helperTextError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  errorBanner: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: SPACING.md - 2,
    paddingVertical: SPACING.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: CONTROL_SIZE.inputHeight - 6,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontWeight: "700",
    fontSize: FONT_SIZE.button,
  },
  formFootnote: {
    color: colors.mutedText,
    fontSize: 12,
    textAlign: "center",
  },
  switchText: {
    textAlign: "center",
    color: colors.mutedText,
    fontSize: FONT_SIZE.body,
  },
  switchLink: {
    color: colors.text,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
