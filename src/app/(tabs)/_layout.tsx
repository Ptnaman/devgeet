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
      <Stack.Screen
        name="notifications"
        options={{ title: "Notifications", headerBackButtonDisplayMode: "minimal" }}
      />
      <Stack.Screen name="profile" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="author/[authorId]" options={{ title: "Author Profile" }} />
      <Stack.Screen name="post/[postId]" options={{ title: "Post Details" }} />
      <Stack.Screen name="category/[categorySlug]" options={{ title: "Category Posts" }} />
    </Stack>
  );
}
