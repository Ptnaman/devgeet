import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Login03Icon, Logout03Icon, Settings01Icon } from "@hugeicons/core-free-icons";

import { useAuth } from "@/providers/auth-provider";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isGuest, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <HugeiconsIcon icon={Settings01Icon} size={56} color="#111827" />
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>
        {isGuest
          ? "Guest mode is active."
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
        <HugeiconsIcon
          icon={isGuest ? Login03Icon : Logout03Icon}
          size={18}
          color="#FFFFFF"
        />
        <Text style={styles.buttonText}>
          {isGuest ? "Login Now" : "Logout"}
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
    marginBottom: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
