import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/providers/auth-provider";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

export default function IndexGate() {
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

  return <Redirect href="/auth-choice" />;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
