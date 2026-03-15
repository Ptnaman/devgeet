import { Redirect, Stack, useRouter } from "expo-router";
import { Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { RADIUS, SPACING, type ThemeColors } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AdminLayout() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { isAdmin, isBootstrapping } = useAuth();
  const styles = createStyles(colors);

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/settings" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerRight: () => (
          <Pressable
            style={({ pressed }) => [
              styles.logoutIconButton,
              pressed && styles.iconButtonPressed,
            ]}
            onPress={() => router.replace("/home")}
          >
            <HugeiconsIcon icon={Logout01Icon} size={18} color={colors.text} />
          </Pressable>
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Admin Panel",
        }}
      />
      <Stack.Screen name="posts/index" options={{ title: "Posts" }} />
      <Stack.Screen name="posts/edit" options={{ title: "Post Editor" }} />
      <Stack.Screen name="categories" options={{ title: "Categories" }} />
			
    </Stack>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  logoutIconButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surface,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.xs,
  },
  iconButtonPressed: {
    opacity: 0.85,
  },
});
