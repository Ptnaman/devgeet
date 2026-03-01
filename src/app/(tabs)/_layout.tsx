import { Tabs, Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Add01Icon,
  FavouriteIcon,
  Home01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";

import { COLORS } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function TabsLayout() {
  const { user, isBootstrapping, isAdmin } = useAuth();

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          headerTitle: "Home",
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={Home01Icon} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorite"
        options={{
          title: "Favorite",
          headerTitle: "Favorite",
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={FavouriteIcon} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerTitle: "Settings",
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={Settings01Icon} color={color} size={size} />
          ),
        }}
      />
      {isAdmin ? (
        <Tabs.Screen
          name="admin"
          options={{
            title: "Admin",
            headerTitle: "Admin",
            tabBarIcon: ({ color, size }) => (
              <HugeiconsIcon icon={Add01Icon} color={color} size={size} />
            ),
          }}
        />
      ) : null}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
