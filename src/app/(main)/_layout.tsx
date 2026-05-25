import { Stack } from "expo-router";

import { useAppTheme } from "@/providers/theme-provider";

export default function MainLayout() {
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
      <Stack.Screen
        name="(tabs)"
        options={{
          title: "Home",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          title: "Notifications",
        }}
      />
      <Stack.Screen name="settings/profile" options={{ title: "Profile" }} />
      <Stack.Screen
        name="settings/help"
        options={{
          title: "Help",
        }}
      />
      <Stack.Screen
        name="settings/app-updates"
        options={{
          title: "App Updates",
        }}
      />
      <Stack.Screen
        name="search"
        options={{
          title: "",
        }}
      />
      <Stack.Screen
        name="settings/profile-edit"
        options={{
          title: "Edit Profile",
        }}
      />
      <Stack.Screen
        name="settings/author-apply"
        options={{
          title: "Switch to Author",
        }}
      />
    </Stack>
  );
}
