import { Tabs } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  FavouriteIcon,
  Home01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";

import { COLORS } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        headerLeft: () => <DrawerToggleButton tintColor={COLORS.text} />,
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
    </Tabs>
  );
}
