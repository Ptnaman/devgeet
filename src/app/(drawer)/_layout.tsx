import { Drawer } from "expo-router/drawer";
import { Redirect } from "expo-router";
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

export default function DrawerLayout() {
  const { user, isAdmin, isBootstrapping } = useAuth();

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
    <Drawer
      initialRouteName="home"
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        drawerActiveTintColor: COLORS.primary,
        drawerInactiveTintColor: COLORS.mutedText,
      }}
    >
      <Drawer.Screen
        name="home"
        options={{
          title: "Home",
          drawerIcon: ({ color, size }) => (
            <HugeiconsIcon icon={Home01Icon} color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="favorite"
        options={{
          title: "Favorite",
          drawerIcon: ({ color, size }) => (
            <HugeiconsIcon icon={FavouriteIcon} color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          title: "Settings",
          drawerIcon: ({ color, size }) => (
            <HugeiconsIcon icon={Settings01Icon} color={color} size={size} />
          ),
        }}
      />
      {isAdmin ? (
        <Drawer.Screen
          name="admin"
          options={{
            title: "Admin Panel",
            headerShown: false,
            drawerIcon: ({ color, size }) => (
              <HugeiconsIcon icon={Add01Icon} color={color} size={size} />
            ),
          }}
        />
      ) : null}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
