import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react-native";

import { AuthEmailField } from "@/components/auth-email-field";
import { DevGeetAuthShell, devgeetAuthStyles as styles } from "@/components/devgeet-auth-shell";
import {
  EMAIL_VALIDATION_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_VALIDATION_MESSAGE,
  isValidEmailAddress,
} from "@/lib/auth-validation";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";

export default function EmailSignupScreen() {
  const router = useRouter();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { signupWithEmailPassword } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = !isSubmitting;

  const clearFieldError = (
    field: "firstName" | "lastName" | "email" | "password" | "confirmPassword",
  ) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const setFieldError = (
    field: "firstName" | "lastName" | "email" | "password" | "confirmPassword",
    message: string,
  ) => {
    setFieldErrors((current) => ({ ...current, [field]: message }));
  };

  const handleSubmit = async () => {
    if (!isConnected) return showOfflineToast();
    if (!firstName.trim()) {
      setFieldError("firstName", "First name is required.");
      return;
    }
    if (!lastName.trim()) {
      setFieldError("lastName", "Last name is required.");
      return;
    }
    if (!isValidEmailAddress(normalizedEmail)) {
      setFieldError("email", EMAIL_VALIDATION_MESSAGE);
      return;
    }
    if (!password) {
      setFieldError("password", "Password is required.");
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setFieldError("password", PASSWORD_VALIDATION_MESSAGE);
      return;
    }
    if (!confirmPassword) {
      setFieldError("confirmPassword", "Confirm your password.");
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("confirmPassword", "Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFieldErrors({});
      await signupWithEmailPassword({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        password,
      });
      router.replace("/(main)/(tabs)");
    } catch (signupError) {
      const message = getActionErrorMessage({
        error: signupError,
        isConnected,
        fallbackMessage: "Unable to create your account right now.",
      });
      if (message === DEFAULT_OFFLINE_MESSAGE) showOfflineToast();
      const target = /email|account|already|exist/i.test(message) ? "email" : "password";
      setFieldError(target, message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DevGeetAuthShell
      headerLabel="Sign up"
      title="Create your account"
      subtitle="Join DevGeet to save favorites and keep your lyrics close."
    >
      <View style={styles.inputStack}>
        <View style={styles.nameRow}>
          <View style={styles.nameField}>
            <AuthEmailField
              forceLight
              label="First Name"
              error={fieldErrors.firstName}
              icon={<UserRound size={20} color="#6B7280" strokeWidth={2} />}
              value={firstName}
              onChangeText={(value) => {
                setFirstName(value);
                clearFieldError("firstName");
              }}
              onBlur={() => {
                if (!firstName.trim()) setFieldError("firstName", "First name is required.");
              }}
              placeholder="First name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoComplete="name-given"
              textContentType="givenName"
              returnKeyType="next"
            />
          </View>
          <View style={styles.nameField}>
            <AuthEmailField
              forceLight
              label="Last Name"
              error={fieldErrors.lastName}
              icon={<UserRound size={20} color="#6B7280" strokeWidth={2} />}
              value={lastName}
              onChangeText={(value) => {
                setLastName(value);
                clearFieldError("lastName");
              }}
              onBlur={() => {
                if (!lastName.trim()) setFieldError("lastName", "Last name is required.");
              }}
              placeholder="Last name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoComplete="name-family"
              textContentType="familyName"
              returnKeyType="next"
            />
          </View>
        </View>
        <AuthEmailField
          forceLight
          label="Email Address"
          error={fieldErrors.email}
          icon={<Mail size={21} color="#6B7280" strokeWidth={2} />}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clearFieldError("email");
          }}
          onBlur={() => {
            if (email.trim() && !isValidEmailAddress(normalizedEmail)) {
              setFieldError("email", EMAIL_VALIDATION_MESSAGE);
            }
          }}
          placeholder="Enter your email address"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <AuthEmailField
          forceLight
          label="Password"
          error={fieldErrors.password}
          icon={<LockKeyhole size={21} color="#6B7280" strokeWidth={2} />}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearFieldError("password");
          }}
          onBlur={() => {
            if (!password) {
              setFieldError("password", "Password is required.");
            } else if (password.length < PASSWORD_MIN_LENGTH) {
              setFieldError("password", PASSWORD_VALIDATION_MESSAGE);
            }
          }}
          placeholder="Create a password"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          secure
        />
        <AuthEmailField
          forceLight
          label="Confirm Password"
          error={fieldErrors.confirmPassword}
          icon={<LockKeyhole size={21} color="#6B7280" strokeWidth={2} />}
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            clearFieldError("confirmPassword");
          }}
          onBlur={() => {
            if (!confirmPassword) {
              setFieldError("confirmPassword", "Confirm your password.");
            } else if (password !== confirmPassword) {
              setFieldError("confirmPassword", "Passwords do not match.");
            }
          }}
          placeholder="Confirm your password"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={() => void handleSubmit()}
          secure
        />
      </View>

      <Text style={styles.optionText}>{PASSWORD_VALIDATION_MESSAGE}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        accessibilityState={{ disabled: !canSubmit, busy: isSubmitting }}
        style={({ pressed }) => [
          styles.primaryButton,
          !canSubmit && styles.primaryButtonDisabled,
          pressed && canSubmit && styles.primaryButtonPressed,
        ]}
        onPress={() => void handleSubmit()}
      >
        <LinearGradient colors={["#7C3AED", "#5B21B6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Create Account</Text>
              <ArrowRight size={19} color="#FFFFFF" strokeWidth={2.4} />
            </>
          )}
        </LinearGradient>
      </Pressable>

      <View style={styles.accountRow}>
        <Text style={styles.accountPrompt}>Already have an account?</Text>
        <Pressable onPress={() => router.push("./email-login")} hitSlop={8}>
          <Text style={styles.linkText}>Login</Text>
        </Pressable>
      </View>
    </DevGeetAuthShell>
  );
}
