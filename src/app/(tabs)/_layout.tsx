import { Tabs, useRouter } from "expo-router";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Add01Icon,
  FavouriteIcon,
  Home01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { Pressable, StyleSheet } from "react-native";

import { COLORS } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function TabsLayout() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        headerRight: () =>
          isAdmin ? (
            <Pressable
              style={({ pressed }) => [
                styles.adminButton,
                pressed && styles.adminButtonPressed,
              ]}
              onPress={() => router.push("/admin")}
            >
              <HugeiconsIcon icon={Add01Icon} size={18} color={COLORS.text} />
            </Pressable>
          ) : null,
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={Home01Icon} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={Add01Icon} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorite"
        options={{
          title: "Favorite",
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={FavouriteIcon} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={Settings01Icon} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="post/[postId]"
        options={{
          href: null,
          title: "Post Details",
        }}
      />
      <Tabs.Screen
        name="terms"
        options={{
          href: null,
          title: "Terms & Conditions",
        }}
      />
      <Tabs.Screen
        name="privacy"
        options={{
          href: null,
          title: "Privacy Policy",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  adminButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  adminButtonPressed: {
    opacity: 0.85,
  },
});
