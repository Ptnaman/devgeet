import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "@/lib/firebase";
import "@/global.css";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider, useAppTheme } from "@/providers/theme-provider";

function AppShell() {
  const { colors, resolvedTheme } = useAppTheme();

  return (
    <>
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
