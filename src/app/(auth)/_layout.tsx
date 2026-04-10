import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { type ThemeColors } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AuthLayout() {
  const { colors } = useAppTheme();
  const { user, isBootstrapping } = useAuth();
  const styles = createStyles(colors);

  if (isBootstrapping) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/home" />;
  }

  return (
    <Stack
      initialRouteName="auth-choice"
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="auth-choice" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: "Login" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Forgot Password" }} />
      <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
    </Stack>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
});
