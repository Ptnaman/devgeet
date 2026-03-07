import { Stack } from "expo-router";

import { COLORS } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="post/[postId]" options={{ title: "Post Details" }} />
    </Stack>
  );
}
