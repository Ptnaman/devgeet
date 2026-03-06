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
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
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

  const clearError = () => {
    if (error) {
      setError("");
    }
  };

  const isLoginDisabled = isSubmitting || !identifier.trim() || !password;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.mainContent}>
        <View style={styles.hero}>
          <Text style={styles.subtitle}>Welcome back to DevGeet.</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Email or Username</Text>
            <TextInput
              value={identifier}
              onChangeText={(value) => {
                setIdentifier(value);
                clearError();
              }}
              onFocus={() => setIsIdentifierFocused(true)}
              onBlur={() => setIsIdentifierFocused(false)}
              placeholder="Enter your email or username"
              placeholderTextColor={COLORS.mutedText}
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
                  clearError();
                }}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.mutedText}
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
              <ActivityIndicator size="small" color={COLORS.primaryText} />
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
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setError("Forgot password flow will be available soon.")}
          >
            <Text style={styles.secondaryButtonText}>Forgot password?</Text>
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

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.background,
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
  subtitle: {
    color: COLORS.mutedText,
    fontSize: FONT_SIZE.body + 1,
    lineHeight: 20,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  field: {
    gap: SPACING.xs,
  },
  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.button,
  },
  inputWithAction: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  inputWithActionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.button,
  },
  inputFocused: {
    borderColor: COLORS.primary,
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
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: CONTROL_SIZE.inputHeight + 2,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    backgroundColor: "#D8DCE3",
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontWeight: "700",
    fontSize: FONT_SIZE.button + 2,
  },
  primaryButtonTextDisabled: {
    color: "#8A90A0",
  },
  secondaryButton: {
    minHeight: CONTROL_SIZE.inputHeight + 2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: "600",
    fontSize: FONT_SIZE.button + 1,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    textAlign: "center",
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
