import { Stack } from "expo-router";

import { MainTabDataProvider } from "@/providers/main-tab-data-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <MainTabDataProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(main)/home" options={{ headerShown: false }} />
        <Stack.Screen name="(main)/[tab]" options={{ headerShown: false }} />
        <Stack.Screen
          name="app-updates"
          options={{
            title: "App Updates",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#0F0F10",
            headerShadowVisible: false,
            contentStyle: { backgroundColor: "#FFFFFF" },
          }}
        />
        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen
          name="profile-edit"
          options={{
            title: "Edit Profile",
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen name="author-apply" options={{ title: "Author Access" }} />
        <Stack.Screen
          name="author-access-verification"
          options={{
            title: "Verify Email",
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="author/[authorId]"
          options={{ title: "Author Profile" }}
        />
        <Stack.Screen name="post/[postId]" options={{ title: "Post Details" }} />
        <Stack.Screen
          name="category/[categorySlug]"
          options={{ title: "Category Posts" }}
        />
      </Stack>
    </MainTabDataProvider>
  );
}
