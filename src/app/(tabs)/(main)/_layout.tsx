import { Stack } from "expo-router";

import { MainTabDataProvider } from "@/providers/main-tab-data-provider";

export default function MainTabsLayout() {
  return (
    <MainTabDataProvider>
      <Stack
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
          animation: "none",
        }}
      >
        <Stack.Screen name="home" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="favorite" />
        <Stack.Screen name="settings" />
      </Stack>
    </MainTabDataProvider>
  );
}
