import { Redirect, Stack, useRouter } from "expo-router";
import { Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { COLORS, RADIUS, SPACING } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function AdminLayout() {
  const router = useRouter();
  const { isAdmin, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/settings" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
        headerRight: () => (
          <Pressable
            style={({ pressed }) => [
              styles.logoutIconButton,
              pressed && styles.iconButtonPressed,
            ]}
            onPress={() => router.replace("/home")}
          >
            <HugeiconsIcon icon={Logout01Icon} size={18} color={COLORS.text} />
          </Pressable>
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Admin Panel",
        }}
      />
      <Stack.Screen name="posts/index" options={{ title: "Posts" }} />
      <Stack.Screen name="posts/edit" options={{ title: "Post Editor" }} />
      <Stack.Screen name="categories" options={{ title: "Categories" }} />
			
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  logoutIconButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.xs,
  },
  iconButtonPressed: {
    opacity: 0.85,
  },
});
