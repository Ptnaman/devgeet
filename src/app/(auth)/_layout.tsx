import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { COLORS } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function AuthLayout() {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="auth-choice" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{ title: "Log in", headerBackButtonDisplayMode: "minimal" }}
      />
      <Stack.Screen
        name="signup"
        options={{ title: "Sign up", headerBackButtonDisplayMode: "minimal" }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
