import { Redirect, Stack } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { COLORS } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function AdminLayout() {
  const { isAdmin, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/settings" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Admin Panel",
          headerLeft: () => <DrawerToggleButton tintColor={COLORS.text} />,
        }}
      />
      <Stack.Screen name="posts/index" options={{ title: "Posts" }} />
      <Stack.Screen name="posts/edit" options={{ title: "Post Editor" }} />
      <Stack.Screen name="categories" options={{ title: "Categories" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
});
