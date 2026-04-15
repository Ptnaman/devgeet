import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { AuthScreenShell } from "@/components/auth-screen-shell";
import { AuthSoftInput } from "@/components/auth-soft-field";
import { CancelInputIcon } from "@/components/icons/cancel-input-icon";
import { ViewOffIcon } from "@/components/icons/view-off-icon";
import { ViewTwotoneRoundedIcon } from "@/components/icons/view-twotone-rounded-icon";
import { APP_LINKS } from "@/constants/app-links";
import { CONTROL_SIZE, FONT_SIZE, SPACING, type ThemeColors } from "@/constants/theme";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import {
  EMAIL_VALIDATION_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_VALIDATION_MESSAGE,
  USERNAME_VALIDATION_MESSAGE,
  isValidEmailAddress,
  isValidUsername,
  normalizeEmailAddress,
  normalizeUsernameValue,
  validateUsername,
} from "@/lib/auth-validation";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

type SignupField =
  | "firstName"
  | "lastName"
  | "email"
  | "username"
  | "password"
  | "confirmPassword"
  | "terms"
  | "form";
type SignupFieldErrors = Partial<Record<SignupField, string>>;
type UsernameAvailabilityState = "idle" | "checking" | "available" | "taken";

const getErrorMessage = (error: unknown, isConnected: boolean) =>
  getActionErrorMessage({
    error,
    isConnected,
    fallbackMessage: "Unable to create account. Please try again.",
  });

const stripWhitespace = (value: string) => value.replace(/\s+/g, "");

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M3 7.2L5.7 9.9L11 4.6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function SignupScreen() {
  const { colors } = useAppTheme();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const router = useRouter();
  const { isUsernameAvailable, signupWithEmail } = useAuth();
  const styles = createStyles(colors);
  const scrollViewRef = useRef<ScrollView>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [usernameAvailability, setUsernameAvailability] =
    useState<UsernameAvailabilityState>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPasswordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const hasPasswordMatch = confirmPassword.length > 0 && password === confirmPassword;
  const isPasswordTooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const normalizedEmail = normalizeEmailAddress(email);
  const normalizedUsername = normalizeUsernameValue(username);
  const emailFormatError =
    normalizedEmail && !isValidEmailAddress(normalizedEmail)
      ? EMAIL_VALIDATION_MESSAGE
      : undefined;
  const usernameFormatError =
    normalizedUsername && !isValidUsername(normalizedUsername)
      ? USERNAME_VALIDATION_MESSAGE
      : undefined;

  useEffect(() => {
    if (!normalizedUsername || usernameFormatError) {
      setUsernameAvailability("idle");
      return;
    }

    let isActive = true;
    setUsernameAvailability("checking");
    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          const available = await isUsernameAvailable(normalizedUsername);

          if (!isActive) {
            return;
          }

          setUsernameAvailability(available ? "available" : "taken");
        } catch {
          if (isActive) {
            setUsernameAvailability("idle");
          }
        }
      })();
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [isUsernameAvailable, normalizedUsername, usernameFormatError]);

  const confirmPasswordTone = hasPasswordMismatch
    ? "error"
    : hasPasswordMatch
      ? "success"
      : "default";

  const clearError = (field?: SignupField | SignupField[]) => {
    setFieldErrors((current) => {
      if (!Object.keys(current).length) {
        return current;
      }

      if (!field) {
        return {};
      }

      const fields = Array.isArray(field) ? field : [field];
      const hasTargetFieldError = fields.some((item) => current[item]);

      if (!hasTargetFieldError && !current.form) {
        return current;
      }

      const next = { ...current };
      for (const item of fields) {
        delete next[item];
      }
      delete next.form;
      return next;
    });
  };

  const getSignupErrorField = (message: string): SignupField => {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("username")) {
      return "username";
    }

    if (normalizedMessage.includes("email")) {
      return "email";
    }

    if (normalizedMessage.includes("password")) {
      return "password";
    }

    return "form";
  };

  const handleSignup = async () => {
    const normalizedFirstName = firstName.trim().replace(/\s+/g, " ");
    const normalizedLastName = lastName.trim().replace(/\s+/g, " ");
    const nextErrors: SignupFieldErrors = {};

    if (!normalizedFirstName) {
      nextErrors.firstName = "Enter your first name.";
    }

    if (!normalizedLastName) {
      nextErrors.lastName = "Enter your last name.";
    }

    if (!normalizedEmail) {
      nextErrors.email = "Enter your email address.";
    } else if (!isValidEmailAddress(normalizedEmail)) {
      nextErrors.email = EMAIL_VALIDATION_MESSAGE;
    }

    if (!normalizedUsername) {
      nextErrors.username = "Enter a username.";
    } else {
      try {
        validateUsername(normalizedUsername);
      } catch (error) {
        nextErrors.username =
          error instanceof Error ? error.message : "Enter a valid username.";
      }

      if (!nextErrors.username) {
        try {
          const available = await isUsernameAvailable(normalizedUsername);

          if (!available) {
            nextErrors.username = "Username is already taken.";
          }
        } catch {
          nextErrors.username = "Unable to verify username right now.";
        }
      }
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      nextErrors.password = PASSWORD_VALIDATION_MESSAGE;
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (!acceptedTerms) {
      nextErrors.terms = "Accept the Terms and Conditions to continue.";
    }

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setFieldErrors({});

      await signupWithEmail({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        username: normalizedUsername,
        password,
      });

      router.replace("/home");
    } catch (signupError) {
      const message = getErrorMessage(signupError, isConnected);
      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }
      setFieldErrors({ [getSignupErrorField(message)]: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSignupDisabled =
    isSubmitting ||
    !firstName.trim() ||
    !lastName.trim() ||
    !normalizedEmail ||
    !normalizedUsername ||
    !password ||
    !confirmPassword ||
    !acceptedTerms ||
    Boolean(emailFormatError) ||
    Boolean(usernameFormatError) ||
    usernameAvailability === "checking" ||
    usernameAvailability === "taken" ||
    isPasswordTooShort ||
    hasPasswordMismatch;

  const firstNameError = fieldErrors.firstName;
  const lastNameError = fieldErrors.lastName;
  const emailError = fieldErrors.email ?? emailFormatError;
  const emailSupportingText =
    "Use an active email address for login, verification, and password reset.";
  const emailSupportingTone = normalizedEmail && !emailError ? "success" : "default";
  const usernameAvailabilityError =
    !fieldErrors.username && !usernameFormatError && usernameAvailability === "taken"
      ? "Username is already taken."
      : undefined;
  const usernameError = fieldErrors.username ?? usernameFormatError ?? usernameAvailabilityError;
  const usernameSupportingText =
    usernameAvailability === "checking"
      ? "Checking username..."
      : usernameAvailability === "available"
        ? "Username is available."
        : "Use 3-20 chars with letters, numbers, dot, underscore, or hyphen.";
  const usernameSupportingTone = usernameAvailability === "available" ? "success" : "default";
  const passwordError =
    fieldErrors.password ?? (isPasswordTooShort ? PASSWORD_VALIDATION_MESSAGE : undefined);
  const passwordSupportingText =
    password.length >= PASSWORD_MIN_LENGTH
      ? "Password length looks good."
      : `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  const passwordSupportingTone = password.length >= PASSWORD_MIN_LENGTH ? "success" : "default";
  const confirmPasswordError =
    fieldErrors.confirmPassword ?? (hasPasswordMismatch ? "Passwords do not match." : undefined);
  const confirmPasswordSupportingText = hasPasswordMatch
    ? "Passwords match."
    : "Re-enter the same password to confirm.";
  const confirmPasswordSupportingTone = hasPasswordMatch ? "success" : "default";
  const emailIconColor = emailError ? colors.danger : colors.iconMuted;
  const passwordIconColor = passwordError ? colors.danger : colors.iconMuted;
  const confirmPasswordIconColor = confirmPasswordError ? colors.danger : colors.iconMuted;

  const openTermsAndConditions = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    try {
      await Linking.openURL(APP_LINKS.terms);
    } catch {
      Alert.alert("Terms & Conditions", "Unable to open Terms & Conditions right now.");
    }
  };

  const revealPasswordFields = () => {
    const delay = Platform.OS === "android" ? 180 : 80;

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, delay);
  };

  return (
    <AuthScreenShell
      eyebrow="Register"
      title="Getting Started"
      subtitle={"Seems you are new here.\nLet\u2019s set up your profile."}
      showTopBar={false}
      topAligned
      backgroundColor={colors.surface}
      safeAreaEdges={["bottom"]}
      scrollViewRef={scrollViewRef}
      scrollContentStyle={styles.compactScrollContent}
      heroStyle={styles.heroBlock}
      titleStyle={styles.heroTitle}
      subtitleStyle={styles.heroSubtitle}
      footer={
        <Text style={styles.footerText}>
          Already have an account?{" "}
          <Link href="/login" style={styles.footerLink}>
            Login
          </Link>
        </Text>
      }
    >
      <View style={styles.formStack}>
        <View style={styles.nameRow}>
          <AuthSoftInput
            label="First Name"
            value={firstName}
            onChangeText={(value) => {
              setFirstName(stripWhitespace(value));
              clearError("firstName");
            }}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            tone={firstNameError ? "error" : "default"}
            errorMessage={firstNameError}
            containerStyle={styles.nameField}
          />

          <AuthSoftInput
            label="Last Name"
            value={lastName}
            onChangeText={(value) => {
              setLastName(stripWhitespace(value));
              clearError("lastName");
            }}
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            tone={lastNameError ? "error" : "default"}
            errorMessage={lastNameError}
            containerStyle={styles.nameField}
          />
        </View>

        <AuthSoftInput
          label="Email Address"
          value={email}
          onChangeText={(value) => {
            setEmail(stripWhitespace(value));
            clearError("email");
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          tone={emailError ? "error" : "default"}
          errorMessage={emailError}
          supportingText={emailSupportingText}
          supportingTone={emailSupportingTone}
          trailingAccessory={
            email ? (
              <Pressable
                style={({ pressed }) => [
                  styles.inputAccessoryButton,
                  pressed ? styles.pressed : undefined,
                ]}
                onPress={() => {
                  setEmail("");
                  clearError("email");
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear email address"
              >
                <CancelInputIcon color={emailIconColor} />
              </Pressable>
            ) : null
          }
        />

        <AuthSoftInput
          label="Username"
          value={username}
          onChangeText={(value) => {
            setUsername(stripWhitespace(value).toLowerCase());
            clearError("username");
          }}
          autoCapitalize="none"
          autoCorrect={false}
          tone={usernameError ? "error" : "default"}
          errorMessage={usernameError}
          supportingText={usernameSupportingText}
          supportingTone={usernameSupportingTone}
        />

        <AuthSoftInput
          label="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(stripWhitespace(value));
            clearError(["password", "confirmPassword"]);
          }}
          secureTextEntry={!isPasswordVisible}
          autoCapitalize="none"
          autoComplete="new-password"
          tone={passwordError ? "error" : "default"}
          errorMessage={passwordError}
          supportingText={passwordSupportingText}
          supportingTone={passwordSupportingTone}
          onFocus={revealPasswordFields}
          trailingAccessory={
            <Pressable
              style={({ pressed }) => [
                styles.inputAccessoryButton,
                pressed ? styles.pressed : undefined,
              ]}
              onPress={() => setIsPasswordVisible((current) => !current)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
            >
              {isPasswordVisible ? (
                <ViewOffIcon color={passwordIconColor} />
              ) : (
                <ViewTwotoneRoundedIcon color={passwordIconColor} />
              )}
            </Pressable>
          }
        />

        <AuthSoftInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(stripWhitespace(value));
            clearError("confirmPassword");
          }}
          secureTextEntry={!isConfirmPasswordVisible}
          autoCapitalize="none"
          autoComplete="new-password"
          tone={confirmPasswordError ? "error" : confirmPasswordTone}
          errorMessage={confirmPasswordError}
          supportingText={confirmPasswordSupportingText}
          supportingTone={confirmPasswordSupportingTone}
          onFocus={revealPasswordFields}
          trailingAccessory={
            <Pressable
              style={({ pressed }) => [
                styles.inputAccessoryButton,
                pressed ? styles.pressed : undefined,
              ]}
              onPress={() => setIsConfirmPasswordVisible((current) => !current)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                isConfirmPasswordVisible ? "Hide confirm password" : "Show confirm password"
              }
            >
              {isConfirmPasswordVisible ? (
                <ViewOffIcon color={confirmPasswordIconColor} />
              ) : (
                <ViewTwotoneRoundedIcon color={confirmPasswordIconColor} />
              )}
            </Pressable>
          }
          onSubmitEditing={() => {
            if (!isSignupDisabled) {
              void handleSignup();
            }
          }}
        />

        {fieldErrors.form ? <Text style={styles.inlineError}>{fieldErrors.form}</Text> : null}

        <View style={[styles.termsBlock, fieldErrors.terms ? styles.termsRowError : undefined]}>
          <View style={styles.termsRow}>
            <Pressable
              style={({ pressed }) => [pressed ? styles.pressed : undefined]}
              onPress={() => {
                setAcceptedTerms((current) => !current);
                clearError("terms");
              }}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
            >
              <View
                style={[
                  styles.checkbox,
                  acceptedTerms ? styles.checkboxChecked : undefined,
                  fieldErrors.terms ? styles.checkboxError : undefined,
                ]}
              >
                {acceptedTerms ? <CheckIcon color={colors.brandPrimaryText} /> : null}
              </View>
            </Pressable>
            <Text style={styles.termsText}>
              By creating an account, you agree to our{" "}
              <Text
                style={styles.termsHighlight}
                accessibilityRole="link"
                suppressHighlighting
                onPress={() => {
                  void openTermsAndConditions();
                }}
              >
                Terms and Conditions
              </Text>
              .
            </Text>
          </View>
        </View>
        {fieldErrors.terms ? <Text style={styles.inlineError}>{fieldErrors.terms}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            isSignupDisabled ? styles.primaryButtonDisabled : undefined,
            pressed && !isSignupDisabled ? styles.pressed : undefined,
          ]}
          onPress={handleSignup}
          disabled={isSignupDisabled}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.brandPrimaryText} />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </Pressable>
      </View>
    </AuthScreenShell>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    compactScrollContent: {
      paddingTop: 0,
    },
    heroBlock: {
      width: "100%",
      gap: SPACING.sm + 2,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.xs,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 36,
      lineHeight: 42,
      fontWeight: "800",
      letterSpacing: -0.6,
      maxWidth: 280,
    },
    heroSubtitle: {
      color: colors.mutedText,
      fontSize: 17,
      lineHeight: 28,
      fontWeight: "600",
      maxWidth: 340,
    },
    formStack: {
      gap: SPACING.lg,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.md,
    },
    nameField: {
      flex: 1,
    },
    inlineError: {
      color: colors.danger,
      fontSize: 12,
      lineHeight: 18,
    },
    termsBlock: {
      gap: SPACING.xs,
    },
    termsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.sm,
    },
    termsRowError: {
      paddingBottom: 2,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.brandAccentBorder,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    checkboxError: {
      borderColor: colors.danger,
    },
    checkboxChecked: {
      backgroundColor: colors.brandAccent,
      borderColor: colors.brandAccent,
    },
    termsText: {
      flex: 1,
      color: colors.subtitleText,
      fontSize: 13,
      lineHeight: 20,
    },
    termsHighlight: {
      color: colors.brandAccent,
      fontWeight: "700",
    },
    primaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: 14,
      backgroundColor: colors.brandPrimary,
      alignItems: "center",
      justifyContent: "center",
    },
    inputAccessoryButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonDisabled: {
      opacity: 0.55,
    },
    primaryButtonText: {
      color: colors.brandPrimaryText,
      fontSize: FONT_SIZE.button,
      fontWeight: "700",
    },
    footerText: {
      textAlign: "center",
      color: colors.subtitleText,
      fontSize: 14,
      lineHeight: 20,
    },
    footerLink: {
      color: colors.brandPrimary,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.82,
    },
  });
