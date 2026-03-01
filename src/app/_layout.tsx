import { Slot } from "expo-router";
import "@/lib/firebase";
import "@/global.css";
import { AuthProvider } from "@/providers/auth-provider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}
