import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { SHADOWS, type ThemeColors } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AdminLayout() {
  const { colors } = useAppTheme();
  const { canManagePosts, isAdmin, isBootstrapping } = useAuth();
  const styles = createStyles(colors);

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!canManagePosts) {
    return <Redirect href="/settings" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomWidth: 0,
          ...SHADOWS.sm,
        },
        headerTintColor: colors.text,
        headerShadowVisible: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: isAdmin ? "Admin Panel" : "Post Studio",
        }}
      />
      <Stack.Screen name="posts/index" options={{ title: isAdmin ? "Posts" : "My Posts" }} />
      <Stack.Screen name="posts/edit" options={{ title: "Post Editor" }} />
      <Stack.Screen name="categories" options={{ title: "Categories" }} />
      <Stack.Screen name="notifications" options={{ title: "Custom Notifications" }} />
      <Stack.Screen name="users" options={{ title: "Users" }} />
    </Stack>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
