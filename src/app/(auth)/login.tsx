import { useEffect, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  LockIcon,
  Login03Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";

import { GoogleAuthButton } from "@/components/google-auth-button";
import { COLORS, CONTROL_SIZE, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

const LAST_LOGIN_IDENTIFIER_KEY = "auth:last_login_identifier";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unable to login. Please try again.";
};

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithEmailOrUsername } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const normalizedIdentifier = identifier.trim();
      await loginWithEmailOrUsername(normalizedIdentifier, password);
      await AsyncStorage.setItem(
        LAST_LOGIN_IDENTIFIER_KEY,
        normalizedIdentifier
      );
      router.replace("/home");
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoginDisabled = isSubmitting || !identifier.trim() || !password;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <HugeiconsIcon icon={Login03Icon} size={28} color={COLORS.primary} />
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>Use your username or email to continue.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Username or Email</Text>
          <View style={styles.inputWrap}>
            <HugeiconsIcon icon={UserIcon} size={18} color={COLORS.tabInactive} />
            <TextInput
              value={identifier}
              onChangeText={(value) => {
                setIdentifier(value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Enter username or email"
              placeholderTextColor={COLORS.mutedText}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <HugeiconsIcon icon={LockIcon} size={18} color={COLORS.tabInactive} />
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Enter password"
              placeholderTextColor={COLORS.mutedText}
              secureTextEntry={!isPasswordVisible}
              autoCapitalize="none"
              style={styles.input}
              onSubmitEditing={() => {
                if (!isLoginDisabled) {
                  void handleLogin();
                }
              }}
            />
            <Pressable
              onPress={() => setIsPasswordVisible((current) => !current)}
              hitSlop={8}
            >
              <Text style={styles.toggleText}>
                {isPasswordVisible ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            isLoginDisabled && styles.buttonDisabled,
          ]}
          onPress={handleLogin}
          disabled={isLoginDisabled}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={COLORS.primaryText} />
          ) : (
            <HugeiconsIcon icon={Login03Icon} size={20} color={COLORS.primaryText} />
          )}
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </Pressable>

        <Text style={styles.orText}>or continue with</Text>

        <GoogleAuthButton
          label="Continue with Google"
          onError={setError}
        />

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
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  hero: {
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
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
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: FONT_SIZE.body,
    textAlign: "center",
  },
  field: {
    gap: SPACING.sm,
  },
  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
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
  toggleText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
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
  orText: {
    textAlign: "center",
    color: COLORS.mutedText,
    fontSize: 13,
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
