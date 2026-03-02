import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Logout03Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpeningFeedback, setIsOpeningFeedback] = useState(false);
  const roleLabel = isAdmin ? "Admin" : "User";
  const appName = Constants.expoConfig?.name ?? "DevGeet";
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const handleAuthButton = async () => {
    try {
      setIsSubmitting(true);
      await logout();
      router.replace("/login");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFeedback = async () => {
    const feedbackEmail = "feedback@devgeet.app";
    const subject = encodeURIComponent(`${appName} Feedback (v${appVersion})`);
    const body = encodeURIComponent(
      "Please share your feedback here.\n\nDevice:\nIssue/Feedback:\n",
    );
    const mailtoUrl = `mailto:${feedbackEmail}?subject=${subject}&body=${body}`;

    try {
      setIsOpeningFeedback(true);
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (!canOpen) {
        Alert.alert(
          "Feedback",
          `Mail app not available. Please send feedback to ${feedbackEmail}`,
        );
        return;
      }
      await Linking.openURL(mailtoUrl);
    } catch {
      Alert.alert(
        "Feedback",
        `Unable to open mail app. Please send feedback to ${feedbackEmail}`,
      );
    } finally {
      setIsOpeningFeedback(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroRow}>
        <HugeiconsIcon icon={Settings01Icon} size={46} color={COLORS.primary} />
        <View style={styles.heroTextWrap}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            {isAdmin
              ? `Admin signed in: ${user?.email || "Admin"}`
              : `Signed in as ${user?.displayName || user?.email || "User"}`}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.roleBadge,
          isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser,
        ]}
      >
        <Text style={styles.roleBadgeText}>{roleLabel} Interface</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>App Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Name</Text>
          <Text style={styles.infoValue}>{appName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>v{appVersion}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Legal & Support</Text>

        <Pressable
          style={({ pressed }) => [
            styles.linkRow,
            pressed && styles.linkRowPressed,
          ]}
          onPress={() => router.push("/terms")}
        >
          <Text style={styles.linkLabel}>Terms & Conditions</Text>
          <Text style={styles.linkArrow}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.linkRow,
            pressed && styles.linkRowPressed,
          ]}
          onPress={() => router.push("/privacy")}
        >
          <Text style={styles.linkLabel}>Privacy Policy</Text>
          <Text style={styles.linkArrow}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.linkRow,
            pressed && styles.linkRowPressed,
            isOpeningFeedback && styles.linkRowDisabled,
          ]}
          onPress={handleOpenFeedback}
          disabled={isOpeningFeedback}
        >
          <Text style={styles.linkLabel}>Send Feedback</Text>
          <Text style={styles.linkArrow}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.helperText}>
        {isAdmin
          ? "Use the Admin Panel button in the top header."
          : "Standard user settings are active."}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          isSubmitting && styles.buttonDisabled,
        ]}
        onPress={handleAuthButton}
        disabled={isSubmitting}
      >
        <HugeiconsIcon icon={Logout03Icon} size={18} color={COLORS.primaryText} />
        <Text style={styles.buttonText}>
          {isSubmitting ? "Logging out..." : "Logout"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  heroTextWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.mutedText,
  },
  roleBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
  },
  roleBadgeUser: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  roleBadgeAdmin: {
    backgroundColor: "#ECFDF5",
    borderColor: "#6EE7B7",
  },
  roleBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  infoLabel: {
    color: COLORS.mutedText,
    fontSize: 13,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  linkRow: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  linkRowPressed: {
    opacity: 0.9,
  },
  linkRowDisabled: {
    opacity: 0.65,
  },
  linkLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  linkArrow: {
    color: COLORS.mutedText,
    fontSize: 20,
    lineHeight: 20,
  },
  helperText: {
    color: COLORS.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    marginTop: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.button,
    fontWeight: "600",
  },
});
