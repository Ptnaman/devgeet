import { StyleSheet, Text, View } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { UserCircleIcon } from "@hugeicons/core-free-icons";

import { COLORS, FONT_SIZE, SPACING } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function HomeScreen() {
  const { user, isGuest } = useAuth();

  const subtitle = isGuest
    ? "You are browsing as guest. Open Settings to login."
    : `Logged in as ${user?.displayName || user?.email || "User"}`;

  return (
    <View style={styles.container}>
      <HugeiconsIcon icon={UserCircleIcon} size={64} color={COLORS.primary} />
      <Text style={styles.title}>Welcome to DevGeet</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
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
  },
});
