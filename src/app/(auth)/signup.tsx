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
import { LockIcon, Mail01Icon } from "@hugeicons/core-free-icons";

import {
  COLORS,
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SPACING,
} from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unable to create account. Please try again.";
};

export default function SignupScreen() {
  const router = useRouter();
  const { signupWithEmail } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Fill first name, last name, email and password.");
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
    !confirmPassword;
  const isEmailError = error.toLowerCase().includes("email");

  const clearError = () => {
    if (error) {
      setError("");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Create Your Account</Text>
      <Text style={styles.subtitle}>Simple signup for all users.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>First Name</Text>
        <TextInput
          value={firstName}
          onChangeText={(value) => {
            setFirstName(value);
            clearError();
          }}
          placeholder="First name"
          placeholderTextColor={COLORS.mutedText}
          autoCapitalize="words"
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Last Name</Text>
        <TextInput
          value={lastName}
          onChangeText={(value) => {
            setLastName(value);
            clearError();
          }}
          placeholder="Last name"
          placeholderTextColor={COLORS.mutedText}
          autoCapitalize="words"
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Email Address</Text>
        <View style={styles.inputWithIcon}>
          <HugeiconsIcon icon={Mail01Icon} size={18} color={COLORS.tabInactive} />
          <TextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              clearError();
            }}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.mutedText}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.inputWithIconText}
          />
        </View>
        {isEmailError ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWithIcon}>
          <HugeiconsIcon icon={LockIcon} size={18} color={COLORS.tabInactive} />
          <TextInput
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              clearError();
            }}
            placeholder="Create a strong password"
            placeholderTextColor={COLORS.mutedText}
            secureTextEntry={!isPasswordVisible}
            autoCapitalize="none"
            style={styles.inputWithIconText}
          />
          <Pressable
            onPress={() => setIsPasswordVisible((current) => !current)}
            hitSlop={8}
          >
            <Text style={styles.toggleText}>{isPasswordVisible ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.inputWithIcon}>
          <HugeiconsIcon icon={LockIcon} size={18} color={COLORS.tabInactive} />
          <TextInput
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              clearError();
            }}
            placeholder="Re-enter your password"
            placeholderTextColor={COLORS.mutedText}
            secureTextEntry={!isConfirmPasswordVisible}
            autoCapitalize="none"
            style={styles.inputWithIconText}
            onSubmitEditing={() => {
              if (!isSignupDisabled) {
                void handleSignup();
              }
            }}
          />
          <Pressable
            onPress={() => setIsConfirmPasswordVisible((current) => !current)}
            hitSlop={8}
          >
            <Text style={styles.toggleText}>
              {isConfirmPasswordVisible ? "Hide" : "Show"}
            </Text>
          </Pressable>
        </View>
      </View>

      {!isEmailError && error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
          isSignupDisabled && styles.buttonDisabled,
        ]}
        onPress={handleSignup}
        disabled={isSignupDisabled}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={COLORS.primaryText} />
        ) : (
          <Text style={styles.primaryButtonText}>Create Account</Text>
        )}
      </Pressable>

      <Text style={styles.switchText}>
        Already have an account?{" "}
        <Link href="/login" style={styles.switchLink}>
          Login
        </Link>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  title: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: FONT_SIZE.body,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  field: {
    gap: SPACING.sm,
  },
  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.button,
  },
  inputWithIcon: {
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
  inputWithIconText: {
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
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontWeight: "700",
    fontSize: FONT_SIZE.button,
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
