import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "@/lib/firebase";
import "@/global.css";
import { AuthProvider } from "@/providers/auth-provider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Slot />
    </AuthProvider>
  );
}
