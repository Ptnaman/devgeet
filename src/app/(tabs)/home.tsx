import { StyleSheet, Text, View } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { UserCircleIcon } from "@hugeicons/core-free-icons";

import { useAuth } from "@/providers/auth-provider";

export default function HomeScreen() {
  const { user, isGuest } = useAuth();

  const subtitle = isGuest
    ? "You are browsing as guest. Open Settings to login."
    : `Logged in as ${user?.displayName || user?.email || "User"}`;

  return (
    <View style={styles.container}>
      <HugeiconsIcon icon={UserCircleIcon} size={64} color="#111827" />
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
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
