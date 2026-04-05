import Constants from "expo-constants";
import { Stack } from "expo-router";
import { useCallback, useState } from "react";

import {
  HeaderProfileButton,
  HeaderProfileMenu,
} from "@/components/header-profile-button";
import { useAppTheme } from "@/providers/theme-provider";

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const appName = Constants.expoConfig?.name ?? "DevGeet";
  const openAccountMenu = useCallback(() => {
    setIsAccountMenuOpen(true);
  }, []);
  const closeAccountMenu = useCallback(() => {
    setIsAccountMenuOpen(false);
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="(main)"
          options={{
            title: appName,
            headerRight: () => <HeaderProfileButton onPress={openAccountMenu} />,
          }}
        />
        <Stack.Screen name="profile" options={{ title: "Edit Profile" }} />
        <Stack.Screen name="post/[postId]" options={{ title: "Post Details" }} />
        <Stack.Screen name="category/[categorySlug]" options={{ title: "Category Posts" }} />
      </Stack>

      <HeaderProfileMenu
        visible={isAccountMenuOpen}
        onClose={closeAccountMenu}
      />
    </>
  );
}
