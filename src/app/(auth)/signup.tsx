import { useState } from "react";
import { Link, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Add01Icon,
  LockIcon,
  Mail01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";

import { GoogleAuthButton } from "@/components/google-auth-button";
import { COLORS, CONTROL_SIZE, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unable to create account. Please try again.";
};

export default function SignupScreen() {
  const router = useRouter();
  const { continueAsGuest, signupWithEmail } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Fill username, email and password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await signupWithEmail(username, email, password);
      router.replace("/home");
    } catch (signupError) {
      setError(getErrorMessage(signupError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      setError("");
      setIsSubmitting(true);
      await continueAsGuest();
      router.replace("/home");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <HugeiconsIcon icon={Add01Icon} size={42} color={COLORS.primary} />
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Sign up with email, choose a username, or use Google.
        </Text>

        <View style={styles.inputWrap}>
          <HugeiconsIcon icon={UserIcon} size={20} color={COLORS.tabInactive} />
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor={COLORS.mutedText}
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <View style={styles.inputWrap}>
          <HugeiconsIcon icon={Mail01Icon} size={20} color={COLORS.tabInactive} />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={COLORS.mutedText}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <View style={styles.inputWrap}>
          <HugeiconsIcon icon={LockIcon} size={20} color={COLORS.tabInactive} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={COLORS.mutedText}
            secureTextEntry
            style={styles.input}
          />
        </View>

        <View style={styles.inputWrap}>
          <HugeiconsIcon icon={LockIcon} size={20} color={COLORS.tabInactive} />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            placeholderTextColor={COLORS.mutedText}
            secureTextEntry
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            isSubmitting && styles.buttonDisabled,
          ]}
          onPress={handleSignup}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={COLORS.primaryText} />
          ) : (
            <HugeiconsIcon icon={Add01Icon} size={20} color={COLORS.primaryText} />
          )}
          <Text style={styles.primaryButtonText}>Sign up</Text>
        </Pressable>

        <GoogleAuthButton label="Sign up with Google" onError={setError} />

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
            isSubmitting && styles.buttonDisabled,
          ]}
          onPress={handleGuestLogin}
          disabled={isSubmitting}
        >
          <Text style={styles.secondaryButtonText}>Login Later</Text>
        </Pressable>

        <Text style={styles.switchText}>
          Already have an account?{" "}
          <Link href="/login" style={styles.switchLink}>
            Login
          </Link>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: FONT_SIZE.heroTitle,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: FONT_SIZE.subtitle,
    marginBottom: 4,
  },
  inputWrap: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.button,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
  },
  primaryButton: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontWeight: "700",
    fontSize: FONT_SIZE.button,
  },
  secondaryButton: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.button,
    fontWeight: "600",
  },
  switchText: {
    textAlign: "center",
    color: COLORS.mutedText,
    marginTop: 4,
  },
  switchLink: {
    color: COLORS.text,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
