import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Check, LockKeyhole, Mail } from "lucide-react-native";

import { AuthEmailField } from "@/components/auth-email-field";
import { DevGeetAuthShell, devgeetAuthStyles as styles } from "@/components/devgeet-auth-shell";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { EMAIL_VALIDATION_MESSAGE, isValidEmailAddress } from "@/lib/auth-validation";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";

export default function EmailLoginScreen() {
  const router = useRouter();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { loginWithEmailPassword, sendPasswordResetForEmail, setRememberSessionPersistence } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState("");
  const [info, setInfo] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = !isSubmitting;

  const clearFieldError = (field: "email" | "password") => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (formError) setFormError("");
    if (info) setInfo("");
  };

  const setFieldError = (field: "email" | "password", message: string) => {
    setFieldErrors((current) => ({ ...current, [field]: message }));
  };

  const handleSubmit = async () => {
    if (!isConnected) return showOfflineToast();
    if (!isValidEmailAddress(normalizedEmail)) {
      setFieldError("email", EMAIL_VALIDATION_MESSAGE);
      return;
    }
    if (!password) {
      setFieldError("password", "Password is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFieldErrors({});
      setFormError("");
      setInfo("");
      await setRememberSessionPersistence(rememberMe);
      await loginWithEmailPassword({ email: normalizedEmail, password });
      router.replace("/(main)/(tabs)");
    } catch (authActionError) {
      const message = getActionErrorMessage({
        error: authActionError,
        isConnected,
        fallbackMessage: "Unable to login right now.",
      });
      if (message === DEFAULT_OFFLINE_MESSAGE) showOfflineToast();
      setFieldError("password", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isConnected) return showOfflineToast();
    if (!isValidEmailAddress(normalizedEmail)) {
      setFieldError("email", EMAIL_VALIDATION_MESSAGE);
      return;
    }

    try {
      setIsSendingReset(true);
      setFieldErrors((current) => ({ ...current, email: undefined }));
      setFormError("");
      setInfo("");
      await sendPasswordResetForEmail(normalizedEmail);
      setInfo("Password reset link sent. Check your inbox.");
    } catch (resetError) {
      const message = getActionErrorMessage({
        error: resetError,
        isConnected,
        fallbackMessage: "Unable to send reset link right now.",
      });
      if (message === DEFAULT_OFFLINE_MESSAGE) showOfflineToast();
      setFieldError("email", message);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <DevGeetAuthShell
      headerLabel="Login"
      title="Login to your account"
      subtitle="Welcome back! Please login to continue."
    >
      <View style={styles.inputStack}>
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
            if (!password) setFieldError("password", "Password is required.");
          }}
          placeholder="Enter your password"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={() => void handleSubmit()}
          secure
        />
      </View>

      <View style={styles.optionsRow}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberMe }}
          style={styles.checkboxButton}
          onPress={() => setRememberMe((selected) => !selected)}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxSelected]}>
            {rememberMe ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
          </View>
          <Text style={styles.optionText}>Remember Me</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isSendingReset}
          accessibilityState={{ disabled: isSendingReset }}
          onPress={() => void handleResetPassword()}
        >
          <Text style={styles.linkText}>
            {isSendingReset ? "Sending..." : "Forgot Password?"}
          </Text>
        </Pressable>
      </View>

      {info ? <Text style={styles.successFeedback}>{info}</Text> : null}

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
              <Text style={styles.primaryButtonText}>Log In</Text>
              <ArrowRight size={19} color="#FFFFFF" strokeWidth={2.4} />
            </>
          )}
        </LinearGradient>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      <GoogleAuthButton
        label="Continue with Google"
        onError={setFormError}
        containerStyle={styles.googleButton}
        textStyle={styles.googleButtonText}
        showTrailingIcon={false}
      />
      {formError ? <Text style={styles.feedback}>{formError}</Text> : null}

      <View style={styles.accountRow}>
        <Text style={styles.accountPrompt}>Don&apos;t have an account?</Text>
        <Pressable onPress={() => router.push("./email-signup")} hitSlop={8}>
          <Text style={styles.linkText}>Sign Up</Text>
        </Pressable>
      </View>
    </DevGeetAuthShell>
  );
}
