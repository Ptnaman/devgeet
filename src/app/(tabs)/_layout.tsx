import { Stack } from "expo-router";

import { useAppTheme } from "@/providers/theme-provider";

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="post/[postId]" options={{ title: "Post Details" }} />
    </Stack>
  );
}
