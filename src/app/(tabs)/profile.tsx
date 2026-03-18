import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const getErrorMessage = (error: unknown, isConnected: boolean) =>
  getActionErrorMessage({
    error,
    isConnected,
    fallbackMessage: "Unable to update profile. Please try again.",
  });

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { user, profile, updateCurrentUserProfile } = useAuth();
  const styles = createStyles(colors);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFirstName(profile?.firstName ?? "");
    setLastName(profile?.lastName ?? "");
    setUsername(profile?.username ?? "");
  }, [profile?.firstName, profile?.lastName, profile?.username]);

  const clearMessages = () => {
    if (error) {
      setError("");
    }

    if (success) {
      setSuccess("");
    }
  };

  if (user && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isDirty =
    firstName.trim() !== (profile?.firstName ?? "") ||
    lastName.trim() !== (profile?.lastName ?? "") ||
    username.trim() !== (profile?.username ?? "");
  const isSaveDisabled =
    isSaving || !firstName.trim() || !lastName.trim() || !username.trim() || !isDirty;

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      setError("First name, last name and username are required.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setSuccess("");
      await updateCurrentUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
      });
      setSuccess("Profile updated successfully.");
    } catch (saveError) {
      const message = getErrorMessage(saveError, isConnected);
      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Account Profile</Text>
        <Text style={styles.title}>Edit your details</Text>
        <Text style={styles.subtitle}>
          Update the name and username shown in your account.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.field}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            value={firstName}
            onChangeText={(value) => {
              setFirstName(value);
              clearMessages();
            }}
            placeholder="First name"
            placeholderTextColor={colors.mutedText}
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
              clearMessages();
            }}
            placeholder="Last name"
            placeholderTextColor={colors.mutedText}
            autoCapitalize="words"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={(value) => {
              setUsername(value);
              clearMessages();
            }}
            placeholder="your.username"
            placeholderTextColor={colors.mutedText}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Text style={styles.helperText}>
            Use 3-20 characters with letters, numbers, dot, underscore, or hyphen.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.readonlyCard}>
            <Text style={styles.readonlyValue}>{profile?.email || user?.email || "-"}</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            isSaveDisabled && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaveDisabled}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <Text style={styles.primaryButtonText}>Save Changes</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  heroCard: {
    borderRadius: RADIUS.xs,
    backgroundColor: colors.surface,
    padding: SPACING.lg,
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: FONT_SIZE.body,
    lineHeight: 20,
  },
  sectionCard: {
    borderRadius: RADIUS.md,
    backgroundColor: colors.surface,
    padding: SPACING.md,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  field: {
    gap: SPACING.sm,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: SPACING.md,
    color: colors.text,
    fontSize: FONT_SIZE.button,
  },
  readonlyCard: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: SPACING.md,
    justifyContent: "center",
  },
  readonlyValue: {
    color: colors.text,
    fontSize: FONT_SIZE.button,
    fontWeight: "500",
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  success: {
    color: colors.success,
    fontSize: 13,
  },
  primaryButton: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontSize: FONT_SIZE.button,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
