import { Redirect, Stack } from "expo-router";

import { AppScreenLoader } from "@/components/app-screen-loader";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AdminLayout() {
  const { colors } = useAppTheme();
  const { canManagePosts, isAdmin, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <AppScreenLoader backgroundColor={colors.background} indicatorColor={colors.primary} />;
  }

  if (!canManagePosts) {
    return <Redirect href="/settings" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
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
      <Stack.Screen name="notifications" options={{ title: "Custom Notifications" }} />
      <Stack.Screen name="categories" options={{ title: "Categories" }} />
      <Stack.Screen name="users" options={{ title: "Users" }} />
    </Stack>
  );
}
