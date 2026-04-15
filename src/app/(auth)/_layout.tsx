import { Redirect, Stack } from "expo-router";

import { AppScreenLoader } from "@/components/app-screen-loader";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AuthLayout() {
  const { colors } = useAppTheme();
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <AppScreenLoader backgroundColor={colors.surface} indicatorColor={colors.primary} />;
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
