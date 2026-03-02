import { Redirect, Stack, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
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
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Admin Panel",
          headerLeft: () => (
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              onPress={() => router.replace("/home")}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ),
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
  backButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  backButtonPressed: {
    opacity: 0.85,
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
});
