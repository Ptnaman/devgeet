import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Logout03Icon, Settings01Icon } from "@hugeicons/core-free-icons";

import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const roleLabel = isAdmin ? "Admin" : "User";

  const handleAuthButton = async () => {
    try {
      setIsSubmitting(true);
      await logout();
      router.replace("/login");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <HugeiconsIcon icon={Settings01Icon} size={56} color={COLORS.primary} />
      <Text style={styles.title}>Settings</Text>
      <View
        style={[
          styles.roleBadge,
          isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser,
        ]}
      >
        <Text style={styles.roleBadgeText}>{roleLabel} Interface</Text>
      </View>
      <Text style={styles.subtitle}>
        {isAdmin
          ? `Admin signed in: ${user?.email || "Admin"}`
          : `Signed in as ${user?.displayName || user?.email || "User"}`}
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
          Logout
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xxl,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.body,
    color: COLORS.mutedText,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  roleBadge: {
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
  button: {
    flexDirection: "row",
    alignItems: "center",
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
