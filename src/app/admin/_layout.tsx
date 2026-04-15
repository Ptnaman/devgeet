import { Redirect, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppScreenLoader } from "@/components/app-screen-loader";
import {
  HeaderNotificationsButton,
  HeaderNotificationsMenu,
} from "@/components/header-notifications";
import { SHADOWS } from "@/constants/theme";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AdminLayout() {
  const { colors } = useAppTheme();
  const { canManagePosts, isAdmin, isBootstrapping } = useAuth();
  const { notifications, unreadCount, isLoading } = useUserNotifications({
    category: "creator",
  });
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);

  const openNotifications = useCallback(() => {
    setIsNotificationsVisible(true);
  }, []);

  const closeNotifications = useCallback(() => {
    setIsNotificationsVisible(false);
  }, []);

  if (isBootstrapping) {
    return <AppScreenLoader backgroundColor={colors.background} indicatorColor={colors.primary} />;
  }

  if (!canManagePosts) {
    return <Redirect href="/settings" />;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
            ...SHADOWS.sm,
          },
          headerTintColor: colors.text,
          headerShadowVisible: true,
          contentStyle: { backgroundColor: colors.background },
          headerRight: () => (
            <View style={styles.headerRightWrap}>
              <HeaderNotificationsButton
                unreadCount={unreadCount}
                onPress={openNotifications}
                backgroundColor={colors.surfaceMuted}
              />
            </View>
          ),
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
        <Stack.Screen name="author-applications" options={{ title: "Author Applications" }} />
        <Stack.Screen name="notifications" options={{ title: "Custom Notifications" }} />
        <Stack.Screen name="users" options={{ title: "Users" }} />
      </Stack>
      <HeaderNotificationsMenu
        visible={isNotificationsVisible}
        onClose={closeNotifications}
        notifications={notifications}
        isLoading={isLoading}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerRightWrap: {
    marginRight: 2,
  },
});
