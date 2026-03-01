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
        <HugeiconsIcon icon={Login03Icon} size={42} color="#111827" />
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>
          Login with username or email, or continue with Google.
        </Text>

        <View style={styles.inputWrap}>
          <HugeiconsIcon icon={UserIcon} size={20} color="#6B7280" />
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Username or email"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            style={styles.input}
          />
          <HugeiconsIcon icon={Mail01Icon} size={20} color="#9CA3AF" />
        </View>

        <View style={styles.inputWrap}>
          <HugeiconsIcon icon={LockIcon} size={20} color="#6B7280" />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
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
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <HugeiconsIcon icon={Login03Icon} size={20} color="#FFFFFF" />
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
    padding: 20,
    backgroundColor: "#F9FAFB",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 14,
    marginBottom: 4,
  },
  inputWrap: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    color: "#111827",
    fontSize: 16,
  },
  error: {
    color: "#B91C1C",
    fontSize: 13,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  switchText: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 4,
  },
  switchLink: {
    color: "#111827",
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
