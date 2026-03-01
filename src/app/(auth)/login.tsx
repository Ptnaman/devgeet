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
  LockIcon,
  Login03Icon,
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
  return "Unable to login. Please try again.";
};

export default function LoginScreen() {
  const router = useRouter();
  const { continueAsGuest, loginWithEmailOrUsername } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setError("Enter username/email and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await loginWithEmailOrUsername(identifier, password);
      router.replace("/home");
    } catch (loginError) {
      setError(getErrorMessage(loginError));
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
        <HugeiconsIcon icon={Login03Icon} size={42} color={COLORS.primary} />
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>
          Login with username or email, or continue with Google.
        </Text>

        <View style={styles.inputWrap}>
          <HugeiconsIcon icon={UserIcon} size={20} color={COLORS.tabInactive} />
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Username or email"
            placeholderTextColor={COLORS.mutedText}
            autoCapitalize="none"
            style={styles.input}
          />
          <HugeiconsIcon icon={Mail01Icon} size={20} color={COLORS.mutedText} />
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            isSubmitting && styles.buttonDisabled,
          ]}
          onPress={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={COLORS.primaryText} />
          ) : (
            <HugeiconsIcon icon={Login03Icon} size={20} color={COLORS.primaryText} />
          )}
          <Text style={styles.primaryButtonText}>Login</Text>
        </Pressable>

        <GoogleAuthButton label="Login with Google" onError={setError} />

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
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={styles.switchLink}>
            Sign up
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
